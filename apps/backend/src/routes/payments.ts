import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createFedapayTransaction } from "../lib/fedapay.js";
import { advanceFor } from "../lib/pricing.js";

const initiateSchema = z.object({
  bookingId: z.string(),
  method: z.enum(["MOMO_MTN", "MOMO_MOOV", "CARD", "CASH"]),
  /** Location ville : régler la totalité au lieu des 30 % d'acompte. */
  payFull: z.boolean().default(false),
});

/**
 * Paiement séquestre. Le montant est immobilisé chez le prestataire jusqu'à
 * 24 h après la course, puis débloqué au chauffeur par l'admin — voir
 * `POST /admin/payments/:id/release`.
 */
export default async function paymentRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/payments/initiate",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const body = initiateSchema.parse(request.body);

      const booking = await fastify.prisma.booking.findUnique({
        where: { id: body.bookingId },
        include: { payment: true },
      });

      if (!booking || booking.clientId !== request.user.userId) {
        return reply.code(404).send({ error: "Réservation introuvable" });
      }
      if (booking.status !== "AWAITING_PAYMENT") {
        return reply.code(409).send({ error: "Cette réservation est déjà réglée" });
      }
      if (!booking.estimatedPriceFcfa) {
        return reply.code(400).send({ error: "Prix non estimé" });
      }

      const total = booking.estimatedPriceFcfa;
      const isLocation = booking.type === "LOCATION_VILLE";
      const dueNow = isLocation && !body.payFull ? advanceFor(total) : total;

      // Espèces : rien à encaisser en ligne, la course est confirmée et le
      // chauffeur collectera. Pas de séquestre possible dans ce cas.
      if (body.method === "CASH") {
        const [payment] = await fastify.prisma.$transaction([
          fastify.prisma.payment.create({
            data: {
              bookingId: booking.id,
              method: "CASH",
              status: "PENDING",
              amountFcfa: total,
              advanceFcfa: isLocation ? dueNow : null,
            },
          }),
          fastify.prisma.booking.update({
            where: { id: booking.id },
            data: { status: "CONFIRMED" },
          }),
        ]);
        return reply.send({ payment, paymentUrl: null });
      }

      const client = await fastify.prisma.user.findUniqueOrThrow({
        where: { id: request.user.userId },
      });

      const transaction = await createFedapayTransaction({
        amountFcfa: dueNow,
        description: `FrontiRide ${booking.reference}`,
        customer: { email: client.email, phone: client.phone },
        callbackUrl: `${process.env.APP_URL}/payments/webhook`,
      });

      const payment = await fastify.prisma.payment.upsert({
        where: { bookingId: booking.id },
        update: {
          method: body.method,
          amountFcfa: total,
          advanceFcfa: isLocation ? dueNow : null,
          fedapayReference: transaction.id,
          status: "PENDING",
        },
        create: {
          bookingId: booking.id,
          method: body.method,
          status: "PENDING",
          amountFcfa: total,
          advanceFcfa: isLocation ? dueNow : null,
          fedapayReference: transaction.id,
        },
      });

      return reply.send({
        payment,
        dueNowFcfa: dueNow,
        paymentUrl: transaction.paymentUrl,
      });
    }
  );

  /**
   * Webhook Fedapay. La signature est vérifiée avant toute écriture : ce
   * point d'entrée est public, n'importe qui peut l'appeler.
   */
  fastify.post("/payments/webhook", async (request, reply) => {
    const secret = process.env.FEDAPAY_WEBHOOK_SECRET;
    const signature = request.headers["x-fedapay-signature"];

    if (secret) {
      const raw = JSON.stringify(request.body);
      const expected = crypto
        .createHmac("sha256", secret)
        .update(raw)
        .digest("hex");

      const provided = Array.isArray(signature) ? signature[0] : signature;
      const ok =
        typeof provided === "string" &&
        provided.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));

      if (!ok) {
        fastify.log.warn("Webhook Fedapay avec signature invalide, ignoré");
        return reply.code(401).send({ error: "Signature invalide" });
      }
    } else if (process.env.NODE_ENV === "production") {
      fastify.log.error("FEDAPAY_WEBHOOK_SECRET manquant en production");
      return reply.code(500).send({ error: "Webhook non configuré" });
    }

    const event = z
      .object({
        name: z.string(),
        entity: z.object({ id: z.union([z.string(), z.number()]) }),
      })
      .parse(request.body);

    const payment = await fastify.prisma.payment.findFirst({
      where: { fedapayReference: String(event.entity.id) },
    });

    if (!payment) {
      fastify.log.warn({ event: event.name }, "Webhook sans paiement correspondant");
      return reply.send({ received: true });
    }

    if (event.name === "transaction.approved") {
      const releaseAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await fastify.prisma.$transaction([
        fastify.prisma.payment.update({
          where: { id: payment.id },
          data: { status: "ESCROW_HELD", escrowReleaseAt: releaseAt },
        }),
        fastify.prisma.booking.update({
          where: { id: payment.bookingId },
          data: { status: "CONFIRMED" },
        }),
      ]);
    } else if (
      event.name === "transaction.declined" ||
      event.name === "transaction.canceled"
    ) {
      await fastify.prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });
    }

    return reply.send({ received: true });
  });
}
