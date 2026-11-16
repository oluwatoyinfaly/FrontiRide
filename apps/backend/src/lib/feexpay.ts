/**
 * Client FeexPay — paiement par demande au téléphone du client (« request to
 * pay ») : le client reçoit une invite sur son téléphone, saisit son code
 * Mobile Money, et FeexPay répond par un statut. Il n'y a pas de page de
 * paiement à ouvrir.
 *
 * Les adresses, champs et statuts ci-dessous viennent du SDK Node officiel
 * (feexpay-sdk 1.0.9), lu directement ; la documentation en ligne n'était pas
 * accessible. Ils n'ont pas été éprouvés contre l'API réelle. Les points qui
 * dépendent d'une réponse réelle sont marqués « À CONFIRMER » : un essai en
 * sandbox suffit à les lever.
 *
 * Variables : FEEXPAY_TOKEN (la clé), FEEXPAY_SHOP_ID (l'identifiant de boutique).
 * FEEXPAY_BASE_URL ne sert qu'aux tests, pour viser un faux serveur.
 */

const DEFAULT_BASE_URL = "https://api.feexpay.me";
const TIMEOUT_MS = 15_000;

export type FeexpayNetwork = "mtn" | "moov";
export type ProviderStatus = "PENDING" | "SUCCESSFUL" | "FAILED";

export function feexpayConfigured(): boolean {
  return Boolean(process.env.FEEXPAY_TOKEN && process.env.FEEXPAY_SHOP_ID);
}

/**
 * - rejected    : FeexPay refuse la demande (numéro invalide, montant…) ;
 *                 c'est à l'utilisateur de corriger.
 * - unavailable : FeexPay ne répond pas ou plante ; réessayer plus tard.
 */
export class FeexpayError extends Error {
  constructor(
    readonly kind: "rejected" | "unavailable" | "not_configured",
    message: string
  ) {
    super(message);
    this.name = "FeexpayError";
  }
}

/**
 * Numéro au format international sans « + » ni séparateur (22997000000).
 * À CONFIRMER : le format attendu par FeexPay (avec ou sans indicatif).
 */
export function formatPhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

async function request(
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<{ status: number; data: Record<string, unknown> }> {
  const token = process.env.FEEXPAY_TOKEN;
  if (!token) throw new FeexpayError("not_configured", "FeexPay n'est pas configuré");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(
      `${process.env.FEEXPAY_BASE_URL ?? DEFAULT_BASE_URL}${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      }
    );

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: response.status, data };
  } catch (error) {
    throw new FeexpayError(
      "unavailable",
      error instanceof Error ? error.message : "FeexPay injoignable"
    );
  } finally {
    clearTimeout(timer);
  }
}

function message(data: Record<string, unknown>, fallback: string): string {
  return typeof data.message === "string" ? data.message : fallback;
}

export interface RequestToPayInput {
  amountFcfa: number;
  phone: string;
  network: FeexpayNetwork;
  motif: string;
  customer: { email: string; fullName: string | null };
}

/** Envoie l'invite de paiement au téléphone ; renvoie la référence à suivre. */
export async function requestToPay(
  input: RequestToPayInput
): Promise<{ reference: string }> {
  const shop = process.env.FEEXPAY_SHOP_ID;
  if (!shop) throw new FeexpayError("not_configured", "FeexPay n'est pas configuré");

  const [firstName, ...rest] = (input.customer.fullName ?? "").trim().split(/\s+/);

  const { status, data } = await request(
    "POST",
    `/api/transactions/public/requesttopay/${input.network}`,
    {
      // À CONFIRMER : le SDK type le montant comme une chaîne et parle de
      // « plus petite unité de la devise » ; le XOF n'en a pas, on envoie des
      // francs entiers.
      amount: String(input.amountFcfa),
      shop,
      phoneNumber: formatPhone(input.phone),
      network: input.network,
      motif: input.motif,
      email: input.customer.email,
      first_name: firstName || undefined,
      last_name: rest.join(" ") || undefined,
    }
  );

  if (status === 400 || status === 422) {
    throw new FeexpayError("rejected", message(data, "Demande refusée"));
  }
  if (status >= 400) {
    throw new FeexpayError("unavailable", message(data, `FeexPay a répondu ${status}`));
  }
  if (data.status === "FAILED") {
    throw new FeexpayError("rejected", message(data, "Demande refusée"));
  }

  // À CONFIRMER : le SDK lit `reference` dans cette réponse.
  const reference = data.reference;
  if (typeof reference !== "string" || reference === "") {
    throw new FeexpayError("unavailable", "Réponse FeexPay sans référence");
  }

  return { reference };
}

/** Statut d'une demande. Tout ce qui n'est pas une issue connue reste en attente. */
export async function fetchStatus(reference: string): Promise<ProviderStatus> {
  const { status, data } = await request(
    "GET",
    `/api/transactions/getrequesttopay/integration/${encodeURIComponent(reference)}`
  );

  if (status >= 400) {
    throw new FeexpayError("unavailable", message(data, `FeexPay a répondu ${status}`));
  }

  return data.status === "SUCCESSFUL" || data.status === "FAILED"
    ? data.status
    : "PENDING";
}
