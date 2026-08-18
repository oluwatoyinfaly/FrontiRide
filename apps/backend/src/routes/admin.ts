import type { FastifyInstance } from "fastify";
import { z } from "zod";

const BOOKING_STATUSES = [
  "DRAFT",
  "AWAITING_PAYMENT",
  "CONFIRMED",
  "DRIVER_ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
] as const;

const DRIVER_STATUSES = [
  "PENDING_DOCUMENTS",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
] as const;

const tranconSchema = z.object({
  originCity: z.string().min(2),
  destinationCity: z.string().min(2),
  borderPoint: z.string().optional(),
  priceFcfa: z.number().int().positive(),
  estimatedCustomsFeeFcfa: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

export default async function adminRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole("ADMIN"));

  /** Chiffres du tableau de bord, en une requête pour l'écran d'accueil. */
  fastify.get("/admin/stats", async (_request, reply) => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [
      pendingDrivers,
      approvedDrivers,
      bookingsByStatus,
      completedRevenue,
      monthRevenue,
      escrowHeld,
      pendingWithdrawals,
      topTroncons,
    ] = await Promise.all([
      fastify.prisma.driver.count({ where: { status: "PENDING_REVIEW" } }),
      fastify.prisma.driver.count({ where: { status: "APPROVED" } }),
      fastify.prisma.booking.groupBy({ by: ["status"], _count: { _all: true } }),
      fastify.prisma.booking.aggregate({
        where: { status: "COMPLETED" },
        _sum: { finalPriceFcfa: true },
        _count: { _all: true },
      }),
      fastify.prisma.booking.aggregate({
        where: { status: "COMPLETED", completedAt: { gte: monthStart } },
        _sum: { finalPriceFcfa: true },
      }),
      fastify.prisma.payment.aggregate({
        where: { status: "ESCROW_HELD" },
        _sum: { amountFcfa: true },
        _count: { _all: true },
      }),
      fastify.prisma.withdrawalRequest.count({ where: { status: "REQUESTED" } }),
      fastify.prisma.booking.groupBy({
        by: ["tranconId"],
        where: { tranconId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { tranconId: "desc" } },
        take: 5,
      }),
    ]);

    const troncons = await fastify.prisma.trancon.findMany({
      where: { id: { in: topTroncons.map((t) => t.tranconId!) } },
    });

    return reply.send({
      drivers: { pendingReview: pendingDrivers, approved: approvedDrivers },
      bookings: Object.fromEntries(
        bookingsByStatus.map((row) => [row.status, row._count._all])
      ),
      revenue: {
        completedCount: completedRevenue._count._all,
        totalFcfa: completedRevenue._sum.finalPriceFcfa ?? 0,
        thisMonthFcfa: monthRevenue._sum.finalPriceFcfa ?? 0,
      },
      escrow: {
        count: escrowHeld._count._all,
        amountFcfa: escrowHeld._sum.amountFcfa ?? 0,
      },
      pendingWithdrawals,
      topTroncons: topTroncons.map((row) => ({
        count: row._count._all,
        trancon: troncons.find((t) => t.id === row.tranconId) ?? null,
      })),
    });
  });

  // --- Chauffeurs ---

  fastify.get("/admin/drivers", async (request, reply) => {
    const { status } = z
      .object({ status: z.enum(DRIVER_STATUSES).optional() })
      .parse(request.query);

    const drivers = await fastify.prisma.driver.findMany({
      where: { status },
      include: {
        user: { select: { fullName: true, email: true, phone: true } },
        documents: true,
        vehicles: true,
        wallet: true,
        _count: { select: { bookings: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return reply.send(drivers);
  });

  fastify.post("/admin/drivers/:id/approve", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);

    const [driver] = await fastify.prisma.$transaction([
      fastify.prisma.driver.update({
        where: { id },
        data: { status: "APPROVED" },
      }),
      fastify.prisma.document.updateMany({
        where: { driverId: id },
        data: { status: "APPROVED", reviewedAt: new Date() },
      }),
    ]);

    await fastify.prisma.driverWallet.upsert({
      where: { driverId: id },
      update: {},
      create: { driverId: id },
    });

    return reply.send(driver);
  });

  fastify.post("/admin/drivers/:id/reject", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const driver = await fastify.prisma.driver.update({
      where: { id },
      data: { status: "REJECTED", isOnline: false },
    });
    return reply.send(driver);
  });

  fastify.post("/admin/drivers/:id/suspend", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const driver = await fastify.prisma.driver.update({
      where: { id },
      data: { status: "SUSPENDED", isOnline: false },
    });
    return reply.send(driver);
  });

  // --- Courses ---

  fastify.get("/admin/bookings", async (request, reply) => {
    const { status, take } = z
      .object({
        status: z.enum(BOOKING_STATUSES).optional(),
        take: z.coerce.number().int().min(1).max(200).default(50),
      })
      .parse(request.query);

    const bookings = await fastify.prisma.booking.findMany({
      where: { status },
      include: {
        client: { select: { fullName: true, email: true, phone: true } },
        driver: { select: { id: true, user: { select: { fullName: true } } } },
        trancon: true,
        payment: true,
      },
      orderBy: { createdAt: "desc" },
      take,
    });

    return reply.send(bookings);
  });

  fastify.post("/admin/bookings/:id/dispute", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const booking = await fastify.prisma.booking.update({
      where: { id },
      data: { status: "DISPUTED" },
    });
    return reply.send(booking);
  });

  // --- Paiements ---

  fastify.get("/admin/payments", async (request, reply) => {
    const { status } = z
      .object({
        status: z
          .enum(["PENDING", "ESCROW_HELD", "RELEASED", "REFUNDED", "FAILED"])
          .optional(),
      })
      .parse(request.query);

    const payments = await fastify.prisma.payment.findMany({
      where: { status },
      include: {
        booking: {
          select: {
            reference: true,
            type: true,
            status: true,
            client: { select: { fullName: true } },
            driver: { select: { id: true, user: { select: { fullName: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return reply.send(payments);
  });

  /**
   * Débloque le séquestre : les gains du chauffeur passent d'en attente à
   * retirables. C'est l'acte comptable central du modèle.
   */
  fastify.post("/admin/payments/:id/release", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);

    const payment = await fastify.prisma.payment.findUnique({
      where: { id },
      include: { booking: { include: { driver: { include: { wallet: true } } } } },
    });

    if (!payment || payment.status !== "ESCROW_HELD") {
      return reply.code(409).send({ error: "Ce paiement n'est pas sous séquestre" });
    }

    const wallet = payment.booking.driver?.wallet;
    if (!wallet) {
      return reply
        .code(409)
        .send({ error: "Le chauffeur n'a pas de portefeuille ouvert" });
    }

    // On transfère ce qui avait été mis en attente à la fin de la course,
    // borné au solde en attente pour éviter tout double déblocage.
    const amount = Math.min(
      wallet.pendingFcfa,
      Math.round(payment.amountFcfa * (1 - wallet.commissionRate))
    );

    await fastify.prisma.$transaction([
      fastify.prisma.payment.update({
        where: { id },
        data: { status: "RELEASED" },
      }),
      fastify.prisma.driverWallet.update({
        where: { id: wallet.id },
        data: {
          pendingFcfa: { decrement: amount },
          balanceFcfa: { increment: amount },
        },
      }),
    ]);

    return reply.send({ ok: true, releasedFcfa: amount });
  });

  fastify.post("/admin/payments/:id/refund", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const payment = await fastify.prisma.payment.update({
      where: { id },
      data: { status: "REFUNDED" },
    });
    return reply.send(payment);
  });

  // --- Retraits chauffeurs ---

  fastify.get("/admin/withdrawals", async (_request, reply) => {
    const withdrawals = await fastify.prisma.withdrawalRequest.findMany({
      include: {
        wallet: {
          include: {
            driver: { include: { user: { select: { fullName: true, phone: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return reply.send(withdrawals);
  });

  fastify.post("/admin/withdrawals/:id/settle", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const withdrawal = await fastify.prisma.withdrawalRequest.update({
      where: { id },
      data: { status: "PAID", settledAt: new Date() },
    });
    return reply.send(withdrawal);
  });

  // --- Tarifs ---

  fastify.get("/admin/troncons", async (_request, reply) => {
    const troncons = await fastify.prisma.trancon.findMany({
      orderBy: { createdAt: "asc" },
    });
    return reply.send(troncons);
  });

  fastify.post("/admin/troncons", async (request, reply) => {
    const body = tranconSchema.parse(request.body);
    const trancon = await fastify.prisma.trancon.create({ data: body });
    return reply.code(201).send(trancon);
  });

  fastify.patch("/admin/troncons/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = tranconSchema.partial().parse(request.body);
    const trancon = await fastify.prisma.trancon.update({
      where: { id },
      data: body,
    });
    return reply.send(trancon);
  });
}
