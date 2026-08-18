import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createFedapayTransaction } from "../lib/fedapay.js";

const initiatePaymentSchema = z.object({
  bookingId: z.string(),
  method: z.enum(["MOMO_MTN", "MOMO_MOOV", "CARD"]),
});

// Paiement séquestre simple pour le MVP : la course est marquée CONFIRMED
// dès que la transaction Fedapay est validée par webhook, le déblocage au
// chauffeur (RELEASED) est déclenché manuellement par l'admin ou par une
// règle 24h à automatiser plus tard.
export default async function paymentsRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/payments/initiate",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const body = initiatePaymentSchema.parse(request.body);
      const { userId } = request.user as { userId: string };

      const booking = await fastify.prisma.booking.findUnique({
        where: { id: body.bookingId },
      });
      if (!booking || booking.clientId !== userId) {
        return reply.code(404).send({ error: "Réservation introuvable" });
      }
      if (!booking.estimatedPriceFcfa) {
        return reply.code(400).send({ error: "Prix non estimé" });
      }

      const client = await fastify.prisma.user.findUniqueOrThrow({
        where: { id: userId },
      });

      const isLocationVille = booking.type === "LOCATION_VILLE";
      const amountFcfa = isLocationVille
        ? Math.round(booking.estimatedPriceFcfa * 0.3)
        : booking.estimatedPriceFcfa;

      const transaction = await createFedapayTransaction({
        amountFcfa,
        description: `FrontiRide - Réservation ${booking.id}`,
        customer: { email: client.email, phone: client.phone },
        callbackUrl: `${process.env.APP_URL}/payments/webhook`,
      });

      const payment = await fastify.prisma.payment.create({
        data: {
          bookingId: booking.id,
          method: body.method,
          status: "PENDING",
          amountFcfa: booking.estimatedPriceFcfa,
          advanceFcfa: isLocationVille ? amountFcfa : null,
          fedapayReference: transaction.id,
        },
      });

      return reply.send({ payment, paymentUrl: transaction.paymentUrl });
    }
  );

  // Webhook Fedapay — à sécuriser avec la vérification de signature avant mise en prod.
  fastify.post("/payments/webhook", async (request, reply) => {
    const event = request.body as {
      name: string;
      entity: { id: string; status: string };
    };

    if (event.name === "transaction.approved") {
      const payment = await fastify.prisma.payment.findFirst({
        where: { fedapayReference: String(event.entity.id) },
      });
      if (payment) {
        await fastify.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "ESCROW_HELD",
            escrowReleaseAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
        await fastify.prisma.booking.update({
          where: { id: payment.bookingId },
          data: { status: "CONFIRMED" },
        });
      }
    }

    return reply.send({ received: true });
  });
}
