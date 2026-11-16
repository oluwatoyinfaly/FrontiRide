import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { activeChannels, issueOtp } from "../lib/otp.js";

const registerSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(8),
  fullName: z.string().min(2).optional(),
  locale: z.enum(["fr", "en"]).default("fr"),
});

const loginSchema = z.object({ email: z.string().email() });

const verifyOtpSchema = z.object({
  userId: z.string(),
  emailCode: z.string().length(6),
  // Exigé seulement si le canal SMS est actif : voir OTP_CHANNELS.
  smsCode: z.string().length(6).optional(),
});

const profileSchema = z.object({
  fullName: z.string().min(2).optional(),
  photoUrl: z.string().url().optional(),
  idDocumentUrl: z.string().url().optional(),
  locale: z.enum(["fr", "en"]).optional(),
});

/**
 * Essais de code ratés par compte. Un code à 6 chiffres n'a que 10⁶
 * combinaisons : sans plafond, dix minutes suffisent à les parcourir. Passé le
 * plafond, les codes en cours sont invalidés et il faut en demander un nouveau
 * — ce que le délai entre deux envois ralentit à son tour.
 *
 * En mémoire : suffisant pour une instance. Plusieurs instances demanderaient
 * de le partager (Redis, ou une colonne en base).
 */
const MAX_FAILED_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const failedAttempts = new Map<string, { count: number; resetAt: number }>();

function recordFailure(userId: string): number {
  const now = Date.now();
  const entry = failedAttempts.get(userId);
  const next =
    entry && entry.resetAt > now
      ? { count: entry.count + 1, resetAt: entry.resetAt }
      : { count: 1, resetAt: now + ATTEMPT_WINDOW_MS };
  failedAttempts.set(userId, next);
  return next.count;
}

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/auth/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);

    const existing = await fastify.prisma.user.findFirst({
      where: { OR: [{ email: body.email }, { phone: body.phone }] },
    });

    if (existing && existing.email !== body.email) {
      return reply
        .code(409)
        .send({ error: "Ce numéro est déjà associé à un autre compte" });
    }

    const user = await fastify.prisma.user.upsert({
      where: { email: body.email },
      update: { phone: body.phone, fullName: body.fullName, locale: body.locale },
      create: {
        email: body.email,
        phone: body.phone,
        fullName: body.fullName,
        locale: body.locale,
      },
    });

    const otp = await issueOtp(fastify, user);
    return reply.code(201).send({ userId: user.id, ...otp });
  });

  fastify.post("/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const user = await fastify.prisma.user.findUnique({
      where: { email: body.email },
    });

    if (!user) {
      return reply.code(404).send({ error: "Aucun compte pour cet email" });
    }

    const otp = await issueOtp(fastify, user);
    return reply.send({ userId: user.id, ...otp });
  });

  fastify.post("/auth/resend-otp", async (request, reply) => {
    const { userId } = z.object({ userId: z.string() }).parse(request.body);

    const user = await fastify.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return reply.code(404).send({ error: "Compte introuvable" });
    }

    const otp = await issueOtp(fastify, user);
    return reply.send(otp);
  });

  // Tous les canaux actifs sont vérifiés en une fois : un compte à moitié
  // vérifié ne sert à rien et compliquerait la reprise du parcours.
  fastify.post("/auth/verify-otp", async (request, reply) => {
    const body = verifyOtpSchema.parse(request.body);
    const channels = activeChannels();

    const codes = await fastify.prisma.otpCode.findMany({
      where: {
        userId: body.userId,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    const submitted = { email: body.emailCode, sms: body.smsCode };
    const allValid = channels.every((channel) =>
      codes.some((c) => c.channel === channel && c.code === submitted[channel])
    );

    if (!allValid) {
      if (recordFailure(body.userId) >= MAX_FAILED_ATTEMPTS) {
        await fastify.prisma.otpCode.updateMany({
          where: { userId: body.userId, consumedAt: null },
          data: { consumedAt: new Date() },
        });
        failedAttempts.delete(body.userId);
        return reply
          .code(429)
          .send({ error: "Trop d'essais : demandez un nouveau code" });
      }
      return reply.code(400).send({ error: "Code invalide ou expiré" });
    }

    failedAttempts.delete(body.userId);

    await fastify.prisma.otpCode.updateMany({
      where: { userId: body.userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const user = await fastify.prisma.user.update({
      where: { id: body.userId },
      data: {
        emailVerified: true,
        // Le téléphone n'est déclaré vérifié que s'il l'a réellement été.
        ...(channels.includes("sms") ? { phoneVerified: true } : {}),
      },
      include: { driverProfile: { select: { id: true, status: true } } },
    });

    const token = fastify.jwt.sign({ userId: user.id, role: user.role });
    return reply.send({ token, user });
  });

  fastify.get(
    "/me",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const user = await fastify.prisma.user.findUnique({
        where: { id: request.user.userId },
        include: {
          driverProfile: {
            include: { wallet: true, vehicles: true, documents: true },
          },
        },
      });

      if (!user) {
        return reply.code(404).send({ error: "Compte introuvable" });
      }

      return reply.send(user);
    }
  );

  fastify.patch(
    "/me",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const body = profileSchema.parse(request.body);
      const user = await fastify.prisma.user.update({
        where: { id: request.user.userId },
        data: body,
      });
      return reply.send(user);
    }
  );
}
