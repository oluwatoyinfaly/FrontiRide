import type { FastifyInstance } from "fastify";
import { mailConfigured, sendOtpEmail } from "./mail.js";

const TTL_MINUTES = 10;

/** Deux envois du code à moins de 30 s d'écart : c'est du bombardement. */
const COOLDOWN_SECONDS = 30;

const KNOWN_CHANNELS = ["email", "sms"] as const;

export type OtpChannel = (typeof KNOWN_CHANNELS)[number];
export type OtpCodes = Partial<Record<OtpChannel, string>>;

/**
 * Canaux exigés pour se connecter, par OTP_CHANNELS (« email,sms » par défaut).
 *
 * « email » seul sert aux essais : on ne vérifie alors que l'adresse, et le
 * téléphone reste marqué non vérifié — on ne prétend pas avoir validé ce
 * qu'on n'a pas validé. En production visée, les deux canaux, SMS ou WhatsApp.
 */
export function activeChannels(): OtpChannel[] {
  const wanted = (process.env.OTP_CHANNELS ?? "email,sms")
    .split(",")
    .map((c) => c.trim())
    .filter((c): c is OtpChannel => (KNOWN_CHANNELS as readonly string[]).includes(c));

  return wanted.length > 0 ? [...new Set(wanted)] : ["email", "sms"];
}

/**
 * Canaux pour lesquels un envoi réel est branché. Aucun fournisseur SMS ou
 * WhatsApp n'existe encore : seul l'email peut partir pour de vrai.
 */
function delivered(channel: OtpChannel): boolean {
  return channel === "email" && mailConfigured();
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export interface IssuedOtp {
  /** Canaux dont l'utilisateur doit saisir le code. */
  channels: OtpChannel[];
  /** Codes renvoyés à l'appelant, pour les essais : voir `exposable`. */
  devCodes: OtpCodes | null;
}

function failure(statusCode: number, message: string): Error {
  return Object.assign(new Error(message), { statusCode });
}

/**
 * Émet un code par canal actif et invalide les précédents.
 *
 * Un canal dont l'envoi est réel (l'email, quand le SMTP est configuré) n'est
 * JAMAIS renvoyé dans la réponse : le code ne doit être lisible que dans la
 * boîte du destinataire. Sans cette règle, brancher l'email ne protégerait
 * rien — il suffirait de lire la réponse de l'API.
 *
 * Seuls les canaux sans envoi réel restent exposés, et hors production
 * uniquement, pour pouvoir dérouler le parcours sans passerelle.
 */
export async function issueOtp(
  fastify: FastifyInstance,
  user: { id: string; email: string; phone: string; locale?: string }
): Promise<IssuedOtp> {
  const channels = activeChannels();
  const anyDelivered = channels.some(delivered);

  // Le délai n'a de sens que si chaque envoi coûte quelque chose ou peut
  // harceler quelqu'un : en mode développement il gênerait les tests.
  if (anyDelivered) {
    const last = await fastify.prisma.otpCode.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (last && Date.now() - last.createdAt.getTime() < COOLDOWN_SECONDS * 1000) {
      throw failure(429, "Un code vient d'être envoyé, patientez quelques secondes");
    }
  }

  await fastify.prisma.otpCode.updateMany({
    where: { userId: user.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);
  const codes: OtpCodes = {};

  for (const channel of channels) {
    const code = generateCode();
    codes[channel] = code;

    await fastify.prisma.otpCode.create({
      data: { userId: user.id, channel, code, expiresAt },
    });

    if (channel === "email" && delivered(channel)) {
      try {
        await sendOtpEmail(user.email, code, user.locale ?? "fr");
      } catch (error) {
        // Le détail (hôte, identifiants refusés…) va au journal ; le client
        // n'en reçoit que l'échec, sans rien qui aide un attaquant.
        fastify.log.error({ err: error }, "Envoi du code par email impossible");
        throw failure(503, "Envoi du code impossible");
      }
      // Le code n'est volontairement pas journalisé : il serait lisible par
      // quiconque a accès aux journaux.
      fastify.log.info({ channel, to: user.email }, "Code OTP envoyé");
    } else {
      const target = channel === "email" ? user.email : user.phone;
      fastify.log.info({ channel, target }, `Code OTP ${code} (non envoyé)`);
    }
  }

  return { channels, devCodes: exposable(codes, channels) };
}

/**
 * Hors production, et pour les seuls canaux sans envoi réel. En production le
 * seul chemin est la réception du message.
 */
function exposable(codes: OtpCodes, channels: OtpChannel[]): OtpCodes | null {
  if (process.env.NODE_ENV === "production") return null;

  const open: OtpCodes = {};
  for (const channel of channels) {
    if (!delivered(channel)) open[channel] = codes[channel];
  }

  return Object.keys(open).length > 0 ? open : null;
}
