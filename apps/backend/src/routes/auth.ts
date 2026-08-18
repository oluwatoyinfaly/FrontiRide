import type { FastifyInstance } from "fastify";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(8),
  fullName: z.string().optional(),
});

const verifyOtpSchema = z.object({
  userId: z.string(),
  channel: z.enum(["email", "sms"]),
  code: z.string().length(6),
});

function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default async function authRoutes(fastify: FastifyInstance) {
  // Inscription client ou chauffeur (le rôle est fixé côté route dédiée /drivers/register).
  fastify.post("/auth/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);

    const user = await fastify.prisma.user.upsert({
      where: { email: body.email },
      update: {},
      create: { email: body.email, phone: body.phone, fullName: body.fullName },
    });

    // MVP: on émet un OTP pour email et SMS. L'envoi réel (provider SMS/email)
    // est à brancher ici — pour l'instant le code est loggé côté serveur.
    for (const channel of ["email", "sms"] as const) {
      const code = generateOtpCode();
      await fastify.prisma.otpCode.create({
        data: {
          userId: user.id,
          channel,
          code,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });
      fastify.log.info(`[OTP:${channel}] ${body.email} -> ${code}`);
    }

    return reply.code(201).send({ userId: user.id });
  });

  fastify.post("/auth/verify-otp", async (request, reply) => {
    const body = verifyOtpSchema.parse(request.body);

    const otp = await fastify.prisma.otpCode.findFirst({
      where: {
        userId: body.userId,
        channel: body.channel,
        code: body.code,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otp) {
      return reply.code(400).send({ error: "Code invalide ou expiré" });
    }

    await fastify.prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });

    const field = body.channel === "email" ? "emailVerified" : "phoneVerified";
    const user = await fastify.prisma.user.update({
      where: { id: body.userId },
      data: { [field]: true },
    });

    if (!user.emailVerified || !user.phoneVerified) {
      return reply.send({ verified: false, user });
    }

    const token = fastify.jwt.sign({ userId: user.id, role: user.role });
    return reply.send({ verified: true, token, user });
  });
}
