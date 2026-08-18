import type { FastifyInstance } from "fastify";

const TTL_MINUTES = 10;
const CHANNELS = ["email", "sms"] as const;

export type OtpChannel = (typeof CHANNELS)[number];

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Émet un code par canal et invalide les codes précédents de l'utilisateur.
 *
 * L'envoi réel (agrégateur SMS, service email) reste à brancher : pour l'instant
 * les codes sont journalisés côté serveur. En dehors de la production ils sont
 * aussi renvoyés à l'appelant pour permettre de tester le parcours de bout en
 * bout sans passerelle SMS — voir `devCodes` plus bas.
 */
export async function issueOtp(
  fastify: FastifyInstance,
  user: { id: string; email: string; phone: string }
): Promise<Record<OtpChannel, string> | null> {
  await fastify.prisma.otpCode.updateMany({
    where: { userId: user.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);
  const codes = {} as Record<OtpChannel, string>;

  for (const channel of CHANNELS) {
    const code = generateCode();
    codes[channel] = code;
    await fastify.prisma.otpCode.create({
      data: { userId: user.id, channel, code, expiresAt },
    });
    const target = channel === "email" ? user.email : user.phone;
    fastify.log.info({ channel, target }, `Code OTP ${code}`);
  }

  return devCodes(codes);
}

/**
 * Ne divulgue les codes que hors production. En production le seul chemin
 * possible est la réception réelle du mail ou du SMS.
 */
function devCodes(
  codes: Record<OtpChannel, string>
): Record<OtpChannel, string> | null {
  return process.env.NODE_ENV === "production" ? null : codes;
}
