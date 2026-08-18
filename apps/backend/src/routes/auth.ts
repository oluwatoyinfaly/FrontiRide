import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { issueOtp } from "../lib/otp.js";

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
  smsCode: z.string().length(6),
});

const profileSchema = z.object({
  fullName: z.string().min(2).optional(),
  photoUrl: z.string().url().optional(),
  idDocumentUrl: z.string().url().optional(),
  locale: z.enum(["fr", "en"]).optional(),
});

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

    const devCodes = await issueOtp(fastify, user);
    return reply.code(201).send({ userId: user.id, devCodes });
  });

  fastify.post("/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const user = await fastify.prisma.user.findUnique({
      where: { email: body.email },
    });

    if (!user) {
      return reply.code(404).send({ error: "Aucun compte pour cet email" });
    }

    const devCodes = await issueOtp(fastify, user);
    return reply.send({ userId: user.id, devCodes });
  });

  fastify.post("/auth/resend-otp", async (request, reply) => {
    const { userId } = z.object({ userId: z.string() }).parse(request.body);

    const user = await fastify.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return reply.code(404).send({ error: "Compte introuvable" });
    }

    const devCodes = await issueOtp(fastify, user);
    return reply.send({ devCodes });
  });

  // Les deux canaux sont vérifiés en une fois : un compte à moitié vérifié
  // ne sert à rien et compliquerait la reprise du parcours.
  fastify.post("/auth/verify-otp", async (request, reply) => {
    const body = verifyOtpSchema.parse(request.body);

    const codes = await fastify.prisma.otpCode.findMany({
      where: {
        userId: body.userId,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    const emailOk = codes.some(
      (c) => c.channel === "email" && c.code === body.emailCode
    );
    const smsOk = codes.some((c) => c.channel === "sms" && c.code === body.smsCode);

    if (!emailOk || !smsOk) {
      return reply.code(400).send({ error: "Code invalide ou expiré" });
    }

    await fastify.prisma.otpCode.updateMany({
      where: { userId: body.userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const user = await fastify.prisma.user.update({
      where: { id: body.userId },
      data: { emailVerified: true, phoneVerified: true },
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
