import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { COMMISSION_RATE, driverEarnings } from "../lib/pricing.js";

const DOCUMENT_TYPES = [
  "CNI",
  "PERMIS",
  "CARTE_GRISE",
  "ASSURANCE",
  "VISITE_TECHNIQUE",
  "CASIER_JUDICIAIRE",
  "PHOTO_VEHICULE",
] as const;

/** Sans ces sept pièces, le dossier ne part pas en validation. */
const REQUIRED_DOCUMENTS = DOCUMENT_TYPES;

const MIN_WITHDRAWAL_FCFA = 5000;

const registerSchema = z.object({
  baseCity: z.enum(["Cotonou", "Lomé"]),
  offersFrontalier: z.boolean().default(true),
  offersLocationVille: z.boolean().default(false),
});

const documentSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  fileUrl: z.string().url(),
});

const vehicleSchema = z.object({
  type: z.enum(["ECONOMIQUE", "CONFORT", "SUV", "PREMIUM", "MINIBUS"]),
  brand: z.string().optional(),
  model: z.string().optional(),
  plateNumber: z.string().min(3),
  seats: z.number().int().min(1).max(50),
  pricePerDay: z.number().int().positive().optional(),
  photoUrl: z.string().url().optional(),
});

const withdrawalSchema = z.object({
  amountFcfa: z.number().int().min(MIN_WITHDRAWAL_FCFA),
  destination: z.string().min(6),
});

export default async function driverRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: fastify.authenticate };
  const asDriver = { preHandler: [fastify.authenticate, fastify.requireDriver] };

  /** Devient chauffeur : le compte client existant est promu. */
  fastify.post("/driver/register", auth, async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const userId = request.user.userId;

    const driver = await fastify.prisma.driver.upsert({
      where: { userId },
      update: body,
      create: { userId, ...body },
    });

    await fastify.prisma.user.update({
      where: { id: userId },
      data: { role: "DRIVER" },
    });

    return reply.code(201).send(driver);
  });

  /**
   * Renonce à devenir chauffeur. Tant que le dossier n'a servi à rien — aucune
   * course, aucun gain — le compte redevient un simple compte client : c'est
   * une candidature qu'on retire, pas un historique qu'on efface.
   */
  fastify.delete("/driver/register", asDriver, async (request, reply) => {
    const driverId = request.driverId!;

    const [rides, wallet] = await Promise.all([
      fastify.prisma.booking.count({ where: { driverId } }),
      fastify.prisma.driverWallet.findUnique({ where: { driverId } }),
    ]);

    if (rides > 0) {
      return reply.code(409).send({
        error: "Des courses sont rattachées à ce profil chauffeur",
      });
    }

    if ((wallet?.balanceFcfa ?? 0) + (wallet?.pendingFcfa ?? 0) > 0) {
      return reply
        .code(409)
        .send({ error: "Le portefeuille doit être vidé avant l'annulation" });
    }

    // Les relations n'ont pas de cascade en base : on les retire dans l'ordre
    // inverse des dépendances, en une transaction.
    await fastify.prisma.$transaction([
      fastify.prisma.withdrawalRequest.deleteMany({
        where: { wallet: { driverId } },
      }),
      fastify.prisma.document.deleteMany({ where: { driverId } }),
      fastify.prisma.vehicle.deleteMany({ where: { driverId } }),
      fastify.prisma.driverWallet.deleteMany({ where: { driverId } }),
      fastify.prisma.driver.delete({ where: { id: driverId } }),
      fastify.prisma.user.update({
        where: { id: request.user.userId },
        data: { role: "CLIENT" },
      }),
    ]);

    return reply.send({ ok: true });
  });

  fastify.get("/driver/me", asDriver, async (request, reply) => {
    const driver = await fastify.prisma.driver.findUnique({
      where: { id: request.driverId },
      include: {
        user: { select: { fullName: true, email: true, phone: true } },
        vehicles: true,
        documents: true,
        wallet: { include: { withdrawals: { orderBy: { createdAt: "desc" } } } },
      },
    });

    const uploaded = new Set(driver?.documents.map((d) => d.type));
    return reply.send({
      ...driver,
      missingDocuments: REQUIRED_DOCUMENTS.filter((t) => !uploaded.has(t)),
    });
  });

  // Le fichier part vers le stockage objet côté client ; on n'enregistre ici
  // que l'URL déjà chargée.
  fastify.post("/driver/documents", asDriver, async (request, reply) => {
    const body = documentSchema.parse(request.body);

    // Re-téléverser une pièce la remplace et la remet en attente de contrôle.
    const document = await fastify.prisma.document.upsert({
      where: {
        driverId_type: { driverId: request.driverId!, type: body.type },
      },
      update: { fileUrl: body.fileUrl, status: "PENDING", reviewedAt: null },
      create: {
        driverId: request.driverId!,
        type: body.type,
        fileUrl: body.fileUrl,
      },
    });

    const documents = await fastify.prisma.document.findMany({
      where: { driverId: request.driverId },
      select: { type: true },
    });
    const uploaded = new Set(documents.map((d) => d.type));
    const complete = REQUIRED_DOCUMENTS.every((t) => uploaded.has(t));

    if (complete) {
      await fastify.prisma.driver.updateMany({
        where: { id: request.driverId, status: "PENDING_DOCUMENTS" },
        data: { status: "PENDING_REVIEW" },
      });
    }

    return reply.code(201).send({
      document,
      missingDocuments: REQUIRED_DOCUMENTS.filter((t) => !uploaded.has(t)),
    });
  });

  fastify.post("/driver/vehicles", asDriver, async (request, reply) => {
    const body = vehicleSchema.parse(request.body);
    const vehicle = await fastify.prisma.vehicle.create({
      data: { driverId: request.driverId!, ...body },
    });
    return reply.code(201).send(vehicle);
  });

  fastify.patch("/driver/status", asDriver, async (request, reply) => {
    const { isOnline } = z
      .object({ isOnline: z.boolean() })
      .parse(request.body);

    const driver = await fastify.prisma.driver.findUnique({
      where: { id: request.driverId },
      select: { status: true },
    });

    if (isOnline && driver?.status !== "APPROVED") {
      return reply
        .code(403)
        .send({ error: "Votre dossier doit être validé avant de passer en ligne" });
    }

    const updated = await fastify.prisma.driver.update({
      where: { id: request.driverId },
      data: { isOnline },
    });
    return reply.send(updated);
  });

  /** Courses payées qu'aucun chauffeur n'a encore prises. */
  fastify.get("/driver/rides/available", asDriver, async (request, reply) => {
    const driver = await fastify.prisma.driver.findUniqueOrThrow({
      where: { id: request.driverId },
    });

    if (driver.status !== "APPROVED") {
      return reply.send([]);
    }

    const types = [
      ...(driver.offersFrontalier ? (["FRONTALIER"] as const) : []),
      ...(driver.offersLocationVille ? (["LOCATION_VILLE"] as const) : []),
    ];

    const rides = await fastify.prisma.booking.findMany({
      where: {
        status: "CONFIRMED",
        driverId: null,
        type: { in: types },
      },
      include: {
        trancon: true,
        client: { select: { fullName: true } },
      },
      orderBy: { departureAt: "asc" },
    });

    return reply.send(rides);
  });

  fastify.get("/driver/rides", asDriver, async (request, reply) => {
    const rides = await fastify.prisma.booking.findMany({
      where: { driverId: request.driverId },
      include: {
        trancon: true,
        rating: true,
        client: { select: { fullName: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return reply.send(rides);
  });

  fastify.post("/driver/rides/:id/accept", asDriver, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);

    // updateMany + filtre sur driverId null : deux chauffeurs qui acceptent en
    // même temps, un seul passe — la base arbitre, pas le serveur.
    const claimed = await fastify.prisma.booking.updateMany({
      where: { id, driverId: null, status: "CONFIRMED" },
      data: {
        driverId: request.driverId,
        status: "DRIVER_ASSIGNED",
        acceptedAt: new Date(),
      },
    });

    if (claimed.count === 0) {
      return reply.code(409).send({ error: "Cette course a déjà été prise" });
    }

    const booking = await fastify.prisma.booking.findUnique({
      where: { id },
      include: { trancon: true, client: { select: { fullName: true, phone: true } } },
    });
    return reply.send(booking);
  });

  fastify.post("/driver/rides/:id/start", asDriver, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);

    const started = await fastify.prisma.booking.updateMany({
      where: { id, driverId: request.driverId, status: "DRIVER_ASSIGNED" },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
    });

    if (started.count === 0) {
      return reply.code(409).send({ error: "Course non démarrable" });
    }
    return reply.send({ ok: true });
  });

  fastify.post("/driver/rides/:id/complete", asDriver, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);

    const booking = await fastify.prisma.booking.findUnique({
      where: { id },
      include: { payment: true },
    });

    if (
      !booking ||
      booking.driverId !== request.driverId ||
      booking.status !== "IN_PROGRESS"
    ) {
      return reply.code(409).send({ error: "Course non terminable" });
    }

    const total = booking.finalPriceFcfa ?? booking.estimatedPriceFcfa ?? 0;
    const wallet = await fastify.prisma.driverWallet.upsert({
      where: { driverId: request.driverId! },
      update: {},
      create: {
        driverId: request.driverId!,
        commissionRate: COMMISSION_RATE[booking.type],
      },
    });
    const earnings = driverEarnings(total, wallet.commissionRate);

    // Les gains restent en attente : ils ne basculent en solde retirable
    // qu'au déblocage du séquestre par l'admin (J+2).
    await fastify.prisma.$transaction([
      fastify.prisma.booking.update({
        where: { id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          finalPriceFcfa: total,
        },
      }),
      fastify.prisma.driverWallet.update({
        where: { id: wallet.id },
        data: { pendingFcfa: { increment: earnings } },
      }),
    ]);

    return reply.send({ ok: true, earningsFcfa: earnings });
  });

  fastify.post("/driver/withdrawals", asDriver, async (request, reply) => {
    const body = withdrawalSchema.parse(request.body);

    const wallet = await fastify.prisma.driverWallet.findUnique({
      where: { driverId: request.driverId },
    });

    if (!wallet || wallet.balanceFcfa < body.amountFcfa) {
      return reply.code(400).send({ error: "Solde insuffisant" });
    }

    const [withdrawal] = await fastify.prisma.$transaction([
      fastify.prisma.withdrawalRequest.create({
        data: {
          walletId: wallet.id,
          amountFcfa: body.amountFcfa,
          destination: body.destination,
        },
      }),
      fastify.prisma.driverWallet.update({
        where: { id: wallet.id },
        data: { balanceFcfa: { decrement: body.amountFcfa } },
      }),
    ]);

    return reply.code(201).send(withdrawal);
  });
}
