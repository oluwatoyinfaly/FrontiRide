import type { FastifyInstance } from "fastify";
import { z } from "zod";

const createFrontalierBookingSchema = z.object({
  tranconId: z.string(),
  departureAt: z.coerce.date(),
  isRoundTrip: z.boolean().default(false),
  seats: z.number().int().min(1).max(4).default(1),
});

// Volet 1 — Transport Frontalier. Pilote MVP : trançon unique Cotonou <-> Lomé.
export default async function ridesRoutes(fastify: FastifyInstance) {
  fastify.get("/troncons", async (_request, reply) => {
    const troncons = await fastify.prisma.trancon.findMany({
      where: { active: true },
    });
    return reply.send(troncons);
  });

  fastify.post(
    "/rides/frontalier",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const body = createFrontalierBookingSchema.parse(request.body);
      const { userId } = request.user as { userId: string };

      const trancon = await fastify.prisma.trancon.findUnique({
        where: { id: body.tranconId },
      });
      if (!trancon || !trancon.active) {
        return reply.code(404).send({ error: "Trançon introuvable" });
      }

      const multiplier = body.isRoundTrip ? 2 : 1;
      const estimatedPriceFcfa =
        (trancon.priceFcfa + trancon.estimatedCustomsFeeFcfa) * multiplier;

      const booking = await fastify.prisma.booking.create({
        data: {
          type: "FRONTALIER",
          status: "AWAITING_PAYMENT",
          clientId: userId,
          tranconId: trancon.id,
          departureAt: body.departureAt,
          isRoundTrip: body.isRoundTrip,
          seats: body.seats,
          estimatedPriceFcfa,
        },
      });

      return reply.code(201).send(booking);
    }
  );

  fastify.get(
    "/rides/frontalier/:id",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const booking = await fastify.prisma.booking.findUnique({
        where: { id },
        include: { trancon: true, driver: true, payment: true },
      });
      if (!booking || booking.type !== "FRONTALIER") {
        return reply.code(404).send({ error: "Course introuvable" });
      }
      return reply.send(booking);
    }
  );
}
