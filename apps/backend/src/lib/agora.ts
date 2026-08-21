import { createHash } from "node:crypto";
import { createRequire } from "node:module";

// agora-token est publié en CommonJS sans exports nommés détectables : un
// `import { RtcTokenBuilder }` échoue au démarrage sous Node en mode ESM.
const require = createRequire(import.meta.url);
const { RtcRole, RtcTokenBuilder } =
  require("agora-token") as typeof import("agora-token");

/**
 * Appels dans l'application, via Agora.
 *
 * Le service n'est actif que si les deux secrets sont fournis. Sans eux, les
 * routes répondent 503 et l'application masque simplement l'option : le reste
 * — WhatsApp, appel téléphonique — continue de fonctionner.
 */
export function agoraCredentials(): { appId: string; certificate: string } | null {
  const appId = process.env.AGORA_APP_ID;
  const certificate = process.env.AGORA_APP_CERTIFICATE;
  return appId && certificate ? { appId, certificate } : null;
}

/** Durée de validité d'un jeton : large pour un appel, court pour un secret. */
const TOKEN_TTL_SECONDS = 3600;

/**
 * Agora identifie un participant par un entier 32 bits. On le dérive de
 * l'identifiant utilisateur : stable d'un appel à l'autre, donc utilisable
 * pour reconnaître qui vient de rejoindre, et sans table de correspondance.
 * Le 0 est réservé par Agora (« attribue-moi un identifiant »), on l'évite.
 */
export function agoraUid(userId: string): number {
  const digest = createHash("sha256").update(userId).digest();
  const value = digest.readUInt32BE(0) % 0xfffffffe;
  return value + 1;
}

/** Canal dérivé de la course : les deux parties s'y retrouvent sans échange. */
export function channelFor(bookingId: string): string {
  return `booking-${bookingId}`;
}

export interface CallCredentials {
  appId: string;
  channel: string;
  uid: number;
  token: string;
  expiresAt: string;
}

export function callCredentials(
  bookingId: string,
  userId: string
): CallCredentials | null {
  const credentials = agoraCredentials();
  if (!credentials) return null;

  const channel = channelFor(bookingId);
  const uid = agoraUid(userId);

  const token = RtcTokenBuilder.buildTokenWithUid(
    credentials.appId,
    credentials.certificate,
    channel,
    uid,
    RtcRole.PUBLISHER,
    TOKEN_TTL_SECONDS,
    TOKEN_TTL_SECONDS
  );

  return {
    appId: credentials.appId,
    channel,
    uid,
    token,
    expiresAt: new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString(),
  };
}
