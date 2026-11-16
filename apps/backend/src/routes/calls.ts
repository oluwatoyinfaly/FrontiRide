import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { agoraCredentials, callCredentials } from "../lib/agora.js";

/**
 * Une sonnerie qui n'a pas été décrochée en 45 secondes est un appel manqué.
 * C'est aussi la fenêtre pendant laquelle le destinataire peut la découvrir en
 * interrogeant l'API.
 */
const RING_TIMEOUT_MS = 45_000;

/** États d'une course où joindre l'autre partie a un sens. */
const CALLABLE_STATUSES = [
  "CONFIRMED",
  "DRIVER_ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

export default async function callRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: fastify.authenticate };

  /**
   * Les deux parties d'une course, vues depuis le compte connecté. Renvoie
   * null si la course n'existe pas, ne concerne pas ce compte, ou n'a pas
   * encore de chauffeur — on n'appelle personne dans le vide.
   */
  async function counterpart(bookingId: string, userId: string) {
    const booking = await fastify.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { driver: { select: { userId: true } } },
    });

    if (!booking || !booking.driver) return null;
    if (!CALLABLE_STATUSES.includes(booking.status as (typeof CALLABLE_STATUSES)[number])) {
      return null;
    }

    if (booking.clientId === userId) {
      return { booking, calleeId: booking.driver.userId };
    }
    if (booking.driver.userId === userId) {
      return { booking, calleeId: booking.clientId };
    }
    return null;
  }

  /** L'application masque l'option d'appel tant que le service n'est pas configuré. */
  fastify.get("/calls/config", auth, async (_request, reply) => {
    return reply.send({ enabled: agoraCredentials() !== null });
  });

  fastify.post("/calls", auth, async (request, reply) => {
    const { bookingId } = z.object({ bookingId: z.string() }).parse(request.body);
    const userId = request.user.userId;

    const pair = await counterpart(bookingId, userId);
    if (!pair) {
      return reply.code(404).send({ error: "Course introuvable" });
    }

    const credentials = callCredentials(bookingId, userId);
    if (!credentials) {
      return reply.code(503).send({ error: "Appel indisponible" });
    }

    // Une sonnerie déjà en cours vers le même destinataire est réutilisée :
    // deux appuis rapides ne doivent pas faire sonner deux fois.
    const since = new Date(Date.now() - RING_TIMEOUT_MS);
    const existing = await fastify.prisma.call.findFirst({
      where: {
        bookingId,
        callerId: userId,
        status: "RINGING",
        createdAt: { gte: since },
      },
    });

    const call =
      existing ??
      (await fastify.prisma.call.create({
        data: {
          bookingId,
          channel: credentials.channel,
          callerId: userId,
          calleeId: pair.calleeId,
        },
      }));

    return reply.code(201).send({ call, credentials });
  });

  /**
   * Sonnerie en attente pour le compte connecté. L'application interroge cette
   * route pendant qu'elle est au premier plan ; le push la remplacera.
   */
  fastify.get("/calls/incoming", auth, async (request, reply) => {
    const since = new Date(Date.now() - RING_TIMEOUT_MS);

    const call = await fastify.prisma.call.findFirst({
      where: {
        calleeId: request.user.userId,
        status: "RINGING",
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      include: {
        booking: { select: { id: true, reference: true, type: true } },
      },
    });

    if (!call) return reply.send(null);

    const caller = await fastify.prisma.user.findUnique({
      where: { id: call.callerId },
      select: { fullName: true, phone: true },
    });

    return reply.send({
      id: call.id,
      channel: call.channel,
      booking: call.booking,
      caller: { fullName: caller?.fullName ?? null, phone: caller?.phone ?? null },
      createdAt: call.createdAt,
    });
  });

  fastify.post("/calls/:id/accept", auth, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const userId = request.user.userId;

    const call = await fastify.prisma.call.findUnique({ where: { id } });
    if (!call || call.calleeId !== userId) {
      return reply.code(404).send({ error: "Appel introuvable" });
    }

    const credentials = callCredentials(call.bookingId, userId);
    if (!credentials) {
      return reply.code(503).send({ error: "Appel indisponible" });
    }

    await fastify.prisma.call.update({
      where: { id },
      data: { status: "ACCEPTED", answeredAt: new Date() },
    });

    return reply.send({ credentials });
  });

  /** Refus ou raccrochage : la même route, l'état diffère. */
  async function close(
    id: string,
    userId: string,
    status: "DECLINED" | "ENDED"
  ): Promise<boolean> {
    const updated = await fastify.prisma.call.updateMany({
      where: {
        id,
        OR: [{ callerId: userId }, { calleeId: userId }],
        status: { in: ["RINGING", "ACCEPTED"] },
      },
      data: { status, endedAt: new Date() },
    });
    return updated.count > 0;
  }

  fastify.post("/calls/:id/decline", auth, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const ok = await close(id, request.user.userId, "DECLINED");
    return ok ? reply.send({ ok: true }) : reply.code(404).send({ error: "Appel introuvable" });
  });

  fastify.post("/calls/:id/end", auth, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const ok = await close(id, request.user.userId, "ENDED");
    return ok ? reply.send({ ok: true }) : reply.code(404).send({ error: "Appel introuvable" });
  });

  /**
   * État d'un appel, pour que l'appelant sache si l'autre a décroché, refusé,
   * ou laissé sonner.
   */
  fastify.get("/calls/:id", auth, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const userId = request.user.userId;

    const call = await fastify.prisma.call.findUnique({ where: { id } });
    if (!call || (call.callerId !== userId && call.calleeId !== userId)) {
      return reply.code(404).send({ error: "Appel introuvable" });
    }

    // Une sonnerie expirée est un appel manqué : on le fige plutôt que de
    // laisser l'appelant attendre indéfiniment.
    if (
      call.status === "RINGING" &&
      Date.now() - call.createdAt.getTime() > RING_TIMEOUT_MS
    ) {
      const missed = await fastify.prisma.call.update({
        where: { id },
        data: { status: "MISSED", endedAt: new Date() },
      });
      return reply.send(missed);
    }

    return reply.send(call);
  });
}
