import Fastify from "fastify";
import cors from "@fastify/cors";
import prismaPlugin from "./plugins/prisma.js";
import authPlugin from "./plugins/auth.js";
import authRoutes from "./routes/auth.js";
import driversRoutes from "./routes/drivers.js";
import ridesRoutes from "./routes/rides.js";
import locationsRoutes from "./routes/locations.js";
import paymentsRoutes from "./routes/payments.js";
import adminRoutes from "./routes/admin.js";

const fastify = Fastify({ logger: true });

await fastify.register(cors, { origin: true });
await fastify.register(prismaPlugin);
await fastify.register(authPlugin);

fastify.get("/health", async () => ({ status: "ok" }));

await fastify.register(authRoutes);
await fastify.register(driversRoutes);
await fastify.register(ridesRoutes);
await fastify.register(locationsRoutes);
await fastify.register(paymentsRoutes);
await fastify.register(adminRoutes);

const port = Number(process.env.PORT ?? 3000);
fastify
  .listen({ port, host: "0.0.0.0" })
  .catch((err) => {
    fastify.log.error(err);
    process.exit(1);
  });
