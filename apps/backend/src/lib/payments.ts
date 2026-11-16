import type { FastifyInstance } from "fastify";
import { FeexpayError, fetchStatus, feexpayConfigured } from "./feexpay.js";

/** Le séquestre se débloque 24 h après la course, sauf litige. */
const ESCROW_HOURS = 24;

/**
 * Une invite de paiement que le client n'a pas validée au bout de ce délai est
 * abandonnée : on ne laisse pas une réservation attendre indéfiniment une
 * confirmation qui ne viendra plus.
 */
const EXPIRY_MINUTES = 15;

export type PaymentOutcome = "PENDING" | "ESCROW_HELD" | "FAILED";

/**
 * Applique à un paiement un statut que FeexPay vient de communiquer : dans la
 * réponse à la création, ou à une interrogation.
 *
 * Idempotente : plusieurs appels simultanés (l'app qui interroge, la
 * réconciliation en arrière-plan) aboutissent au même état. La transition se
 * fait par une mise à jour conditionnelle sur PENDING, dont un seul appel sort
 * gagnant.
 */
export async function applyProviderStatus(
  fastify: FastifyInstance,
  payment: { id: string; bookingId: string; createdAt: Date },
  status: "PENDING" | "SUCCESSFUL" | "FAILED"
): Promise<PaymentOutcome> {
  if (status === "SUCCESSFUL") {
    const releaseAt = new Date(Date.now() + ESCROW_HOURS * 60 * 60 * 1000);

    const won = await fastify.prisma.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "ESCROW_HELD", escrowReleaseAt: releaseAt },
    });
    if (won.count > 0) {
      await fastify.prisma.booking.updateMany({
        where: { id: payment.bookingId, status: "AWAITING_PAYMENT" },
        data: { status: "CONFIRMED" },
      });
    }
    return "ESCROW_HELD";
  }

  const expired =
    Date.now() - payment.createdAt.getTime() > EXPIRY_MINUTES * 60 * 1000;

  if (status === "FAILED" || expired) {
    await fastify.prisma.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "FAILED" },
    });
    return "FAILED";
  }

  return "PENDING";
}

/**
 * Interroge FeexPay sur un paiement en attente et applique le résultat.
 *
 * C'est FeexPay lui-même qu'on interroge, avec notre clé : la confirmation
 * d'un paiement ne repose jamais sur un appel entrant qu'on ne pourrait pas
 * authentifier. Personne ne peut déclarer une course réglée en envoyant une
 * requête à l'API — il faudrait que FeexPay la confirme.
 */
export async function settlePayment(
  fastify: FastifyInstance,
  paymentId: string
): Promise<PaymentOutcome> {
  const payment = await fastify.prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) return "FAILED";
  if (payment.status === "ESCROW_HELD" || payment.status === "RELEASED") {
    return "ESCROW_HELD";
  }
  if (payment.status !== "PENDING" || !payment.providerReference) {
    return payment.status === "FAILED" ? "FAILED" : "PENDING";
  }

  let status: "PENDING" | "SUCCESSFUL" | "FAILED";
  try {
    status = await fetchStatus(payment.providerReference);
  } catch (error) {
    // FeexPay injoignable : on ne tranche pas, on réessaiera. Un paiement trop
    // ancien est tout de même abandonné — voir applyProviderStatus.
    if (error instanceof FeexpayError) {
      return applyProviderStatus(fastify, payment, "PENDING");
    }
    throw error;
  }

  return applyProviderStatus(fastify, payment, status);
}

/**
 * Filet de sécurité : un client qui valide sur son téléphone puis ferme
 * l'application ne reviendra peut-être pas interroger son paiement. Ce passage
 * en arrière-plan règle les paiements en attente à sa place.
 */
export function startPaymentReconciliation(
  fastify: FastifyInstance,
  everyMs = 20_000
): NodeJS.Timeout | null {
  if (!feexpayConfigured()) return null;

  const timer = setInterval(async () => {
    try {
      const pending = await fastify.prisma.payment.findMany({
        where: {
          status: "PENDING",
          providerReference: { not: null },
          // Les paiements anciens sont réglés (en échec) par ce même passage.
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        select: { id: true },
        take: 50,
      });

      for (const { id } of pending) {
        await settlePayment(fastify, id);
      }
    } catch (error) {
      fastify.log.error({ err: error }, "Réconciliation des paiements en échec");
    }
  }, everyMs);

  // Ne retient pas le processus à l'arrêt.
  timer.unref();
  return timer;
}
