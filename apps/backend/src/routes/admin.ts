import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";

async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const { role } = request.user as { role: string };
  if (role !== "ADMIN") {
    return reply.code(403).send({ error: "Réservé aux administrateurs" });
  }
}

const createTranconSchema = z.object({
  originCity: z.string(),
  destinationCity: z.string(),
  borderPoint: z.string().optional(),
  priceFcfa: z.number().int().positive(),
  estimatedCustomsFeeFcfa: z.number().int().min(0).default(0),
});

export default async function adminRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", requireAdmin);

  fastify.get("/admin/drivers/pending", async (_request, reply) => {
    const drivers = await fastify.prisma.driver.findMany({
      where: { status: "PENDING_REVIEW" },
      include: { user: true, documents: true, vehicles: true },
    });
    return reply.send(drivers);
  });

  fastify.post("/admin/drivers/:id/approve", async (request, reply) => {
    const { id } = request.params as { id: string };
    const driver = await fastify.prisma.driver.update({
      where: { id },
      data: { status: "APPROVED" },
    });
    await fastify.prisma.driverWallet.upsert({
      where: { driverId: id },
      update: {},
      create: { driverId: id },
    });
    return reply.send(driver);
  });

  fastify.post("/admin/drivers/:id/reject", async (request, reply) => {
    const { id } = request.params as { id: string };
    const driver = await fastify.prisma.driver.update({
      where: { id },
      data: { status: "REJECTED" },
    });
    return reply.send(driver);
  });

  // Grille tarifaire du corridor pilote (Cotonou <-> Lomé au départ).
  fastify.post("/admin/troncons", async (request, reply) => {
    const body = createTranconSchema.parse(request.body);
    const trancon = await fastify.prisma.trancon.create({ data: body });
    return reply.code(201).send(trancon);
  });

  fastify.get("/admin/bookings", async (request, reply) => {
    const { status } = request.query as { status?: string };
    const bookings = await fastify.prisma.booking.findMany({
      where: status ? { status: status as never } : undefined,
      include: { client: true, driver: true, payment: true },
      orderBy: { createdAt: "desc" },
    });
    return reply.send(bookings);
  });
}
