// Doit précéder tout import qui lit process.env (Prisma, JWT…).
import "./env.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import prismaPlugin from "./plugins/prisma.js";
import authPlugin from "./plugins/auth.js";
import authRoutes from "./routes/auth.js";
import bookingRoutes from "./routes/bookings.js";
import driverRoutes from "./routes/drivers.js";
import paymentRoutes from "./routes/payments.js";
import adminRoutes from "./routes/admin.js";
import callRoutes from "./routes/calls.js";
import fileRoutes from "./routes/files.js";
import { startPaymentReconciliation } from "./lib/payments.js";

const fastify = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? "info" },
});

// Une erreur de validation Zod est une faute du client (400), pas une panne
// serveur : sans ce traitement Fastify la remonterait en 500.
fastify.setErrorHandler((error, _request, reply) => {
  if (error instanceof ZodError) {
    return reply.code(400).send({
      error: "Requête invalide",
      details: error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
  }

  const err = error as { statusCode?: number; message?: string };
  const status = err.statusCode ?? 500;
  if (status >= 500) fastify.log.error(error);
  return reply
    .code(status)
    .send({ error: status >= 500 ? "Erreur serveur" : err.message });
});

await fastify.register(cors, { origin: true });

/**
 * Limitation de débit, par adresse IP du visiteur. L'API est derrière
 * Cloudflare puis le proxy de Coolify : l'adresse vue par le serveur est celle
 * du proxy, commune à tous. On lit donc celle que Cloudflare transmet, puis la
 * première de X-Forwarded-For. Ces en-têtes peuvent être forgés par qui appelle
 * l'origine en direct ; la limite reste alors au moins par en-tête, et les
 * plafonds par compte (délai entre deux codes, essais ratés) ne dépendent pas
 * de l'IP.
 */
export function clientIp(request: { headers: Record<string, unknown>; ip: string }): string {
  const cf = request.headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf) return cf;
  const xff = request.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff) return xff.split(",")[0].trim();
  return request.ip;
}

await fastify.register(rateLimit, {
  global: true,
  max: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 600),
  timeWindow: "1 minute",
  keyGenerator: clientIp,
  errorResponseBuilder: () => ({
    statusCode: 429,
    message: "Trop de requêtes, réessayez dans un instant",
  }),
});
await fastify.register(prismaPlugin);
await fastify.register(authPlugin);

fastify.get("/health", async () => ({ status: "ok" }));

await fastify.register(authRoutes);
await fastify.register(bookingRoutes);
await fastify.register(driverRoutes);
await fastify.register(paymentRoutes);
await fastify.register(adminRoutes);
await fastify.register(callRoutes);
await fastify.register(fileRoutes);

const port = Number(process.env.PORT ?? 47001);

try {
  await fastify.listen({ port, host: "0.0.0.0" });
  // Règle en arrière-plan les paiements que le client n'est pas revenu suivre.
  startPaymentReconciliation(fastify);
} catch (error) {
  fastify.log.error(error);
  process.exit(1);
}
