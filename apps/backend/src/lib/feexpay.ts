/**
 * Client FeexPay — paiement par demande au téléphone du client (« request to
 * pay ») : le client reçoit une invite sur son téléphone, saisit son code
 * Mobile Money, et FeexPay répond par un statut. Il n'y a pas de page de
 * paiement à ouvrir.
 *
 * Source : la documentation FeexPay V2 (pages « Payin », « Payin status » et
 * « Sandbox »). Aucun appel n'a encore été fait contre l'API réelle : ce qui
 * reste à vérifier en sandbox est marqué « À CONFIRMER ».
 *
 * Variables :
 *   FEEXPAY_TOKEN    la clé (une clé de test commence par « test_ »)
 *   FEEXPAY_SHOP_ID  l'identifiant public de la boutique
 *   FEEXPAY_ENV      « sandbox » ou « live » ; déduit de la clé si absent
 *   FEEXPAY_BASE_URL réservé aux tests, pour viser un faux serveur
 */

const SANDBOX_URL = "https://sandbox-api.feexpay.me";
const LIVE_URL = "https://api-v2.feexpay.me";
const TIMEOUT_MS = 15_000;

/** Bornes imposées par FeexPay à un encaissement : entier de 10 à 1 000 000. */
export const MIN_AMOUNT_FCFA = 10;
export const MAX_AMOUNT_FCFA = 1_000_000;

/**
 * À CONFIRMER pour le Togo : la documentation transmise liste les codes réseau
 * « MOOV TG » et « TOGOCOM TG » mais ne montre pas leurs adresses ni le format
 * des numéros. Les adresses suivent le schéma des autres canaux (celtiis_bj,
 * mtn_ci…) et le numéro est supposé « 228 » + 8 chiffres.
 */
export type FeexpayNetwork = "mtn" | "moov" | "celtiis_bj" | "moov_tg" | "togocom_tg";

const TOGO_NETWORKS: readonly FeexpayNetwork[] = ["moov_tg", "togocom_tg"];
export type ProviderStatus = "PENDING" | "SUCCESSFUL" | "FAILED";

export function feexpayConfigured(): boolean {
  return Boolean(process.env.FEEXPAY_TOKEN && process.env.FEEXPAY_SHOP_ID);
}

/**
 * La sandbox et la production n'ont PAS la même adresse : une clé de test envoyée
 * à la production est refusée. Sans réglage explicite, on la devine à la clé
 * elle-même, qui commence par « test_ » en sandbox.
 */
function baseUrl(): string {
  if (process.env.FEEXPAY_BASE_URL) return process.env.FEEXPAY_BASE_URL;

  const env =
    process.env.FEEXPAY_ENV ??
    (process.env.FEEXPAY_TOKEN?.startsWith("test_") ? "sandbox" : "live");

  return env === "sandbox" ? SANDBOX_URL : LIVE_URL;
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
 * Numéro tel que l'attend FeexPay, selon le pays du réseau choisi.
 *
 * Bénin : « 229 » + « 01 » + 8 chiffres, le format à 10 chiffres. MTN le
 * demande, Moov et Celtiis l'exigent. Un utilisateur saisit pourtant encore
 * « 97 00 00 00 » : on convertit plutôt que de lui renvoyer un refus
 * incompréhensible.
 *
 * Togo : « 228 » + 8 chiffres (à confirmer).
 *
 * Un numéro d'un autre pays que celui du réseau est refusé avec une phrase
 * claire : payer avec une SIM béninoise sur un réseau togolais est impossible.
 */
export function formatPhone(phone: string, network: FeexpayNetwork): string {
  const togo = TOGO_NETWORKS.includes(network);
  const country = togo ? "228" : "229";

  const explicitCountry = /^\s*(\+|00)/.test(phone);
  let digits = phone.replace(/\D/g, "");
  if (/^\s*00/.test(phone)) digits = digits.replace(/^00/, "");

  const hasCountry =
    explicitCountry ||
    ((digits.startsWith("229") || digits.startsWith("228")) && digits.length >= 11);

  if (hasCountry && !digits.startsWith(country)) {
    throw new FeexpayError(
      "rejected",
      togo
        ? "Ce réseau demande un numéro togolais (+228)."
        : "Ce réseau demande un numéro béninois (+229)."
    );
  }

  const local = hasCountry ? digits.slice(3) : digits;

  if (togo) {
    if (local.length !== 8) throw new FeexpayError("rejected", "Numéro Mobile Money invalide.");
    return `${country}${local}`;
  }

  const valid = local.length === 8 || (local.length === 10 && local.startsWith("01"));
  if (!valid) throw new FeexpayError("rejected", "Numéro Mobile Money invalide.");

  return `${country}${local.length === 8 ? `01${local}` : local}`;
}

/** FeexPay refuse les caractères spéciaux dans la description (tirets compris). */
function cleanDescription(text: string): string {
  return text.replace(/[^A-Za-z0-9 ]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
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
      `${baseUrl()}${path}`,
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
  /** Nettoyée avant envoi : 40 caractères, sans caractère spécial. */
  description: string;
  customer: { email: string; fullName: string | null };
}

/**
 * Envoie l'invite de paiement au téléphone ; renvoie la référence à suivre et le
 * statut immédiat. MTN et Moov répondent déjà le statut final ; Celtiis répond
 * « en attente » puis le règle quelques secondes plus tard.
 */
export async function requestToPay(
  input: RequestToPayInput
): Promise<{ reference: string; status: "PENDING" | "SUCCESSFUL" }> {
  const shop = process.env.FEEXPAY_SHOP_ID;
  if (!shop) throw new FeexpayError("not_configured", "FeexPay n'est pas configuré");

  if (
    !Number.isInteger(input.amountFcfa) ||
    input.amountFcfa < MIN_AMOUNT_FCFA ||
    input.amountFcfa > MAX_AMOUNT_FCFA
  ) {
    throw new FeexpayError(
      "rejected",
      `Le Mobile Money accepte de ${MIN_AMOUNT_FCFA} à ${MAX_AMOUNT_FCFA.toLocaleString("fr-FR")} FCFA par paiement. Payez en espèces ou réglez l'acompte seulement.`
    );
  }

  const phoneNumber = formatPhone(input.phone, input.network);
  const [firstName, ...rest] = (input.customer.fullName ?? "").trim().split(/\s+/);

  const { status, data } = await request(
    "POST",
    `/api/transactions/public/requesttopay/${input.network}`,
    {
      amount: input.amountFcfa,
      phoneNumber,
      shop,
      description: cleanDescription(input.description),
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
  // Refus immédiat — solde insuffisant par exemple : le client doit le savoir.
  if (data.status === "FAILED") {
    throw new FeexpayError("rejected", message(data, "Paiement refusé"));
  }

  const reference = data.reference;
  if (typeof reference !== "string" || reference === "") {
    throw new FeexpayError("unavailable", "Réponse FeexPay sans référence");
  }

  return {
    reference,
    status: data.status === "SUCCESSFUL" ? "SUCCESSFUL" : "PENDING",
  };
}

/**
 * Statut d'une demande. « PENDING » et « IN PENDING STATE » veulent dire que le
 * client n'a pas encore validé : tout ce qui n'est pas une issue connue reste en
 * attente.
 *
 * À CONFIRMER : la documentation montre cette route sur l'adresse de production ;
 * on suppose le même chemin sur la sandbox.
 */
export async function fetchStatus(reference: string): Promise<ProviderStatus> {
  const { status, data } = await request(
    "GET",
    `/api/transactions/public/single/status/${encodeURIComponent(reference)}`
  );

  if (status >= 400) {
    throw new FeexpayError("unavailable", message(data, `FeexPay a répondu ${status}`));
  }

  return data.status === "SUCCESSFUL" || data.status === "FAILED"
    ? data.status
    : "PENDING";
}
