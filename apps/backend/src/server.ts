// Doit précéder tout import qui lit process.env (Prisma, JWT…).
import "./env.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
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

  fastify.log.error(error);
  const status = error.statusCode ?? 500;
  return reply
    .code(status)
    .send({ error: status >= 500 ? "Erreur serveur" : error.message });
});

await fastify.register(cors, { origin: true });
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
