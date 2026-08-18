import type { FastifyInstance } from "fastify";
import { z } from "zod";

const createLocationBookingSchema = z.object({
  city: z.enum(["Cotonou", "Lomé"]),
  vehicleType: z.enum(["ECONOMIQUE", "CONFORT", "SUV", "PREMIUM", "MINIBUS"]),
  startAt: z.coerce.date(),
  durationDays: z.number().int().min(1).max(30),
});

const ADVANCE_RATIO = 0.3;

// Volet 2 — Location Ville avec chauffeur. Pilote MVP : Cotonou et Lomé, à la journée.
export default async function locationsRoutes(fastify: FastifyInstance) {
  fastify.get("/vehicles", async (request, reply) => {
    const { city, vehicleType } = request.query as {
      city?: string;
      vehicleType?: string;
    };

    const vehicles = await fastify.prisma.vehicle.findMany({
      where: {
        type: vehicleType as never,
        driver: {
          baseCity: city,
          offersLocationVille: true,
          status: "APPROVED",
        },
      },
      include: { driver: true },
    });

    return reply.send(vehicles);
  });

  fastify.post(
    "/rides/location-ville",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const body = createLocationBookingSchema.parse(request.body);
      const { userId } = request.user as { userId: string };

      const vehicle = await fastify.prisma.vehicle.findFirst({
        where: {
          type: body.vehicleType,
          driver: { baseCity: body.city, offersLocationVille: true, status: "APPROVED" },
        },
      });

      if (!vehicle || !vehicle.pricePerDay) {
        return reply
          .code(404)
          .send({ error: "Aucun véhicule disponible pour ces critères" });
      }

      const estimatedPriceFcfa = vehicle.pricePerDay * body.durationDays;
      const advanceFcfa = Math.round(estimatedPriceFcfa * ADVANCE_RATIO);

      const booking = await fastify.prisma.booking.create({
        data: {
          type: "LOCATION_VILLE",
          status: "AWAITING_PAYMENT",
          clientId: userId,
          vehicleId: vehicle.id,
          driverId: vehicle.driverId,
          city: body.city,
          vehicleType: body.vehicleType,
          startAt: body.startAt,
          durationDays: body.durationDays,
          estimatedPriceFcfa,
        },
      });

      return reply.code(201).send({ booking, advanceFcfa });
    }
  );
}
