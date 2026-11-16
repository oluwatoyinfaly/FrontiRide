import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { FeexpayError, feexpayConfigured, requestToPay } from "../lib/feexpay.js";
import { settlePayment } from "../lib/payments.js";
import { advanceFor } from "../lib/pricing.js";

const initiateSchema = z.object({
  bookingId: z.string(),
  method: z.enum(["MOMO_MTN", "MOMO_MOOV", "CARD", "CASH"]),
  /** Location ville : régler la totalité au lieu des 30 % d'acompte. */
  payFull: z.boolean().default(false),
  /**
   * Numéro Mobile Money qui recevra l'invite. Souvent différent de celui du
   * compte : on paie avec la SIM qui a de l'argent dessus, pas forcément celle
   * qu'on a donnée à l'inscription.
   */
  phone: z.string().min(8).optional(),
});

const NETWORK = { MOMO_MTN: "mtn", MOMO_MOOV: "moov" } as const;

/**
 * Paiement séquestre. Le montant est immobilisé jusqu'à 24 h après la course,
 * puis débloqué au chauffeur par l'admin — voir `POST /admin/payments/:id/release`.
 *
 * Mobile Money, via FeexPay : le client reçoit une invite sur son téléphone et
 * la valide. L'application attend ensuite, en interrogeant
 * `GET /payments/:id/status`, que FeexPay confirme.
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
          fastify.prisma.payment.upsert({
            where: { bookingId: booking.id },
            update: {
              method: "CASH",
              status: "PENDING",
              amountFcfa: total,
              advanceFcfa: isLocation ? dueNow : null,
              providerReference: null,
            },
            create: {
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
        return reply.send({ payment, status: "CONFIRMED" });
      }

      if (body.method === "CARD") {
        return reply.code(400).send({ error: "Paiement par carte indisponible" });
      }

      if (!feexpayConfigured()) {
        return reply
          .code(503)
          .send({ error: "Paiement Mobile Money indisponible pour le moment" });
      }

      // Une invite est déjà partie sur le téléphone du client : en envoyer une
      // seconde lui ferait valider deux fois la même somme.
      if (booking.payment?.status === "PENDING" && booking.payment.providerReference) {
        const outcome = await settlePayment(fastify, booking.payment.id);
        if (outcome === "PENDING") {
          return reply.code(409).send({
            error: "Un paiement attend votre validation sur le téléphone",
            paymentId: booking.payment.id,
          });
        }
        if (outcome === "ESCROW_HELD") {
          return reply.code(409).send({ error: "Cette réservation est déjà réglée" });
        }
      }

      const client = await fastify.prisma.user.findUniqueOrThrow({
        where: { id: request.user.userId },
      });

      let reference: string;
      try {
        ({ reference } = await requestToPay({
          amountFcfa: dueNow,
          phone: body.phone ?? client.phone,
          network: NETWORK[body.method],
          motif: `FrontiRide ${booking.reference}`,
          customer: { email: client.email, fullName: client.fullName },
        }));
      } catch (error) {
        if (error instanceof FeexpayError) {
          fastify.log.error({ err: error }, "Demande de paiement FeexPay échouée");
          // Refus du prestataire : on renvoie son motif, c'est l'utilisateur
          // qui doit corriger (numéro, réseau…). Panne : message neutre.
          return error.kind === "rejected"
            ? reply.code(400).send({ error: error.message })
            : reply.code(503).send({ error: "Paiement indisponible, réessayez" });
        }
        throw error;
      }

      const payment = await fastify.prisma.payment.upsert({
        where: { bookingId: booking.id },
        update: {
          method: body.method,
          amountFcfa: total,
          advanceFcfa: isLocation ? dueNow : null,
          providerReference: reference,
          status: "PENDING",
        },
        create: {
          bookingId: booking.id,
          method: body.method,
          status: "PENDING",
          amountFcfa: total,
          advanceFcfa: isLocation ? dueNow : null,
          providerReference: reference,
        },
      });

      return reply.code(202).send({ payment, dueNowFcfa: dueNow, status: "PENDING" });
    }
  );

  /**
   * Où en est un paiement. L'application l'interroge pendant que le client
   * valide sur son téléphone ; chaque appel demande à FeexPay et applique le
   * résultat.
   */
  fastify.get(
    "/payments/:id/status",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);

      const payment = await fastify.prisma.payment.findUnique({
        where: { id },
        include: { booking: { select: { clientId: true } } },
      });

      if (!payment || payment.booking.clientId !== request.user.userId) {
        return reply.code(404).send({ error: "Paiement introuvable" });
      }

      const status = await settlePayment(fastify, id);
      return reply.send({ status });
    }
  );
}
