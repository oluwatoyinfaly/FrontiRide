import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { advanceFor, frontalierPrice, locationPrice } from "../lib/pricing.js";
import { createBookingWithReference } from "../lib/reference.js";

const VEHICLE_TYPES = [
  "ECONOMIQUE",
  "CONFORT",
  "SUV",
  "PREMIUM",
  "MINIBUS",
] as const;

const frontalierSchema = z.object({
  tranconId: z.string(),
  departureAt: z.coerce.date(),
  isRoundTrip: z.boolean().default(false),
  seats: z.number().int().min(1).max(4).default(1),
});

const locationSchema = z.object({
  vehicleId: z.string(),
  startAt: z.coerce.date(),
  durationDays: z.number().int().min(1).max(30),
});

const ratingSchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

/** Détail renvoyé au client : assez pour l'écran de suivi, sans fuite de données. */
const bookingInclude = {
  trancon: true,
  payment: true,
  rating: true,
  vehicle: { select: { id: true, type: true, brand: true, model: true, seats: true } },
  driver: {
    select: {
      id: true,
      ratingAverage: true,
      user: { select: { fullName: true, phone: true, photoUrl: true } },
    },
  },
} as const;

/** Une réservation encore annulable sans intervention de l'admin. */
const CANCELLABLE = ["AWAITING_PAYMENT", "CONFIRMED", "DRIVER_ASSIGNED"] as const;

export default async function bookingRoutes(fastify: FastifyInstance) {
  // --- Catalogue, consultable sans compte : sert aussi de vitrine ---

  fastify.get("/troncons", async (_request, reply) => {
    const troncons = await fastify.prisma.trancon.findMany({
      where: { active: true },
      orderBy: { originCity: "asc" },
    });
    return reply.send(troncons);
  });

  fastify.get("/vehicles", async (request, reply) => {
    const query = z
      .object({
        city: z.string().optional(),
        type: z.enum(VEHICLE_TYPES).optional(),
      })
      .parse(request.query);

    const vehicles = await fastify.prisma.vehicle.findMany({
      where: {
        type: query.type,
        pricePerDay: { not: null },
        driver: {
          baseCity: query.city,
          offersLocationVille: true,
          status: "APPROVED",
        },
      },
      include: {
        driver: {
          select: {
            id: true,
            baseCity: true,
            ratingAverage: true,
            user: { select: { fullName: true } },
          },
        },
      },
      orderBy: { pricePerDay: "asc" },
    });

    return reply.send(vehicles);
  });

  // --- Réservations du client connecté ---

  const auth = { preHandler: fastify.authenticate };

  fastify.post("/bookings/frontalier", auth, async (request, reply) => {
    const body = frontalierSchema.parse(request.body);

    const trancon = await fastify.prisma.trancon.findUnique({
      where: { id: body.tranconId },
    });
    if (!trancon?.active) {
      return reply.code(404).send({ error: "Trajet indisponible" });
    }
    if (body.departureAt.getTime() < Date.now()) {
      return reply.code(400).send({ error: "La date de départ est passée" });
    }

    const price = frontalierPrice(trancon, { isRoundTrip: body.isRoundTrip });

    const booking = await createBookingWithReference(
      (reference) =>
        fastify.prisma.booking.create({
          data: {
            reference,
            type: "FRONTALIER",
            status: "AWAITING_PAYMENT",
            clientId: request.user.userId,
            tranconId: trancon.id,
            departureAt: body.departureAt,
            isRoundTrip: body.isRoundTrip,
            seats: body.seats,
            estimatedPriceFcfa: price.totalFcfa,
          },
          include: bookingInclude,
        }),
      "FRONTALIER"
    );

    return reply.code(201).send({ booking, price });
  });

  fastify.post("/bookings/location-ville", auth, async (request, reply) => {
    const body = locationSchema.parse(request.body);

    const vehicle = await fastify.prisma.vehicle.findUnique({
      where: { id: body.vehicleId },
      include: { driver: true },
    });

    if (!vehicle?.pricePerDay || vehicle.driver.status !== "APPROVED") {
      return reply.code(404).send({ error: "Véhicule indisponible" });
    }
    if (body.startAt.getTime() < Date.now()) {
      return reply.code(400).send({ error: "La date de début est passée" });
    }

    const endAt = new Date(body.startAt);
    endAt.setDate(endAt.getDate() + body.durationDays);

    // Deux périodes se chevauchent si chacune commence avant que l'autre ne
    // finisse. Tester la seule date de début rendrait le véhicule
    // définitivement irréservable après sa première location.
    const clash = await fastify.prisma.booking.findFirst({
      where: {
        vehicleId: vehicle.id,
        status: { in: ["CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS"] },
        startAt: { lt: endAt },
        endAt: { gt: body.startAt },
      },
    });
    if (clash) {
      return reply
        .code(409)
        .send({ error: "Ce véhicule est déjà réservé sur cette période" });
    }

    const price = locationPrice(vehicle, { durationDays: body.durationDays });

    const booking = await createBookingWithReference(
      (reference) =>
        fastify.prisma.booking.create({
          data: {
            reference,
            type: "LOCATION_VILLE",
            status: "AWAITING_PAYMENT",
            clientId: request.user.userId,
            vehicleId: vehicle.id,
            driverId: vehicle.driverId,
            city: vehicle.driver.baseCity,
            vehicleType: vehicle.type,
            startAt: body.startAt,
            endAt,
            durationDays: body.durationDays,
            estimatedPriceFcfa: price.totalFcfa,
          },
          include: bookingInclude,
        }),
      "LOCATION_VILLE"
    );

    return reply
      .code(201)
      .send({ booking, price, advanceFcfa: advanceFor(price.totalFcfa) });
  });

  fastify.get("/bookings", auth, async (request, reply) => {
    const bookings = await fastify.prisma.booking.findMany({
      where: { clientId: request.user.userId },
      include: bookingInclude,
      orderBy: { createdAt: "desc" },
    });
    return reply.send(bookings);
  });

  fastify.get("/bookings/:id", auth, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);

    const booking = await fastify.prisma.booking.findUnique({
      where: { id },
      include: bookingInclude,
    });

    if (!booking || booking.clientId !== request.user.userId) {
      return reply.code(404).send({ error: "Réservation introuvable" });
    }

    return reply.send(booking);
  });

  fastify.post("/bookings/:id/cancel", auth, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { reason } = z
      .object({ reason: z.string().max(300).optional() })
      .parse(request.body ?? {});

    const booking = await fastify.prisma.booking.findUnique({ where: { id } });
    if (!booking || booking.clientId !== request.user.userId) {
      return reply.code(404).send({ error: "Réservation introuvable" });
    }
    if (!CANCELLABLE.includes(booking.status as (typeof CANCELLABLE)[number])) {
      return reply
        .code(409)
        .send({ error: "Cette réservation ne peut plus être annulée" });
    }

    const updated = await fastify.prisma.booking.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: reason,
      },
      include: bookingInclude,
    });

    // Le remboursement du séquestre reste une décision admin : l'annulation
    // tardive entraîne une retenue, arbitrée au cas par cas.
    if (updated.payment?.status === "ESCROW_HELD") {
      fastify.log.warn(
        { bookingId: id },
        "Annulation avec séquestre actif : remboursement à arbitrer"
      );
    }

    return reply.send(updated);
  });

  fastify.post("/bookings/:id/rating", auth, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = ratingSchema.parse(request.body);

    const booking = await fastify.prisma.booking.findUnique({
      where: { id },
      include: { rating: true },
    });

    if (!booking || booking.clientId !== request.user.userId) {
      return reply.code(404).send({ error: "Réservation introuvable" });
    }
    if (booking.status !== "COMPLETED") {
      return reply
        .code(409)
        .send({ error: "La course doit être terminée pour être notée" });
    }
    if (booking.rating) {
      return reply.code(409).send({ error: "Cette course est déjà notée" });
    }
    if (!booking.driverId) {
      return reply.code(409).send({ error: "Aucun chauffeur à noter" });
    }

    const rating = await fastify.prisma.rating.create({
      data: {
        bookingId: booking.id,
        clientId: request.user.userId,
        driverId: booking.driverId,
        score: body.score,
        comment: body.comment,
      },
    });

    // La moyenne est recalculée à chaque note plutôt que maintenue en
    // incrémental : le volume est faible et le calcul reste exact.
    const aggregate = await fastify.prisma.rating.aggregate({
      where: { driverId: booking.driverId },
      _avg: { score: true },
    });
    await fastify.prisma.driver.update({
      where: { id: booking.driverId },
      data: { ratingAverage: aggregate._avg.score ?? 0 },
    });

    return reply.code(201).send(rating);
  });
}
