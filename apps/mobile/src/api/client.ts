import Constants from "expo-constants";
import type {
  Booking,
  Call,
  CallCredentials,
  IncomingCall,
  DriverProfile,
  DriverRide,
  Payment,
  PriceBreakdown,
  Trancon,
  User,
  Vehicle,
  VehicleType,
} from "./types";

/**
 * Rend l'adresse utilisable quoi qu'on ait saisi : sans « https:// » une requête
 * échoue sans explication, et un slash final donne « …//auth/login ».
 */
function normalizeApiUrl(raw: string): string {
  const url = raw.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(url)) return url;
  const local = /^(localhost|127\.|\d{1,3}(\.\d{1,3}){3})/.test(url);
  return `${local ? "http" : "https"}://${url}`;
}

/** Port de l'API, hors des ports de développement usuels (voir README). */
const API_PORT = 47001;

/**
 * URL du backend. En développement on vise par défaut la machine qui sert
 * Metro : c'est presque toujours celle qui fait aussi tourner l'API, et ça
 * évite d'avoir à retenir l'adresse IP locale sur téléphone réel.
 */
function defaultApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return normalizeApiUrl(configured);

  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return host ? `http://${host}:${API_PORT}` : `http://localhost:${API_PORT}`;
}

export const API_URL = defaultApiUrl();

let authToken: string | null = null;

/** En-têtes d'accès pour les images servies par l'API (photo du chauffeur). */
export function authImageHeaders(): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

export function setAuthToken(token: string | null) {
  authToken = token;
}

/** Erreur d'API portant le code HTTP, pour distinguer 409 de 500 côté écran. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Corps de la réponse d'erreur, quand l'API y joint autre chose qu'un message. */
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Sans délai maximal, une adresse filtrée par un pare-feu ne renvoie jamais
 * rien : `fetch` reste en attente et l'écran appelant tourne indéfiniment.
 * On préfère une erreur réseau franche, que les écrans savent afficher.
 */
const TIMEOUT_MS = 12000;

async function request<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs: number = TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response: Response;

    try {
      response = await fetch(`${API_URL}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...init.headers,
        },
      });
    } catch {
      // Panne réseau ou délai dépassé : status 0 permet aux écrans
      // d'afficher le bon message.
      throw new ApiError(0, "network");
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new ApiError(
        response.status,
        (payload as { error?: string } | null)?.error ?? response.statusText,
        (payload as Record<string, unknown> | null) ?? undefined
      );
    }

    return payload as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Un envoi de photo dépasse vite les 12 s d'une requête ordinaire en 3G. */
const UPLOAD_TIMEOUT_MS = 60000;

/**
 * Téléverse une image (photo d'une pièce justificative) et renvoie l'adresse
 * sous laquelle le serveur la conserve. Pas d'en-tête Content-Type : c'est
 * fetch qui le pose, avec la frontière du multipart, qu'on ne peut pas deviner.
 */
async function uploadImage(uri: string, mimeType?: string | null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  const form = new FormData();
  // React Native accepte cet objet {uri, name, type} à la place d'un Blob.
  form.append("file", {
    uri,
    name: "piece.jpg",
    type: mimeType ?? "image/jpeg",
  } as unknown as Blob);

  try {
    const response = await fetch(`${API_URL}/uploads`, {
      method: "POST",
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      body: form,
      signal: controller.signal,
    }).catch(() => {
      throw new ApiError(0, "network");
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ApiError(
        response.status,
        (payload as { error?: string } | null)?.error ?? response.statusText
      );
    }
    return payload as { url: string };
  } finally {
    clearTimeout(timer);
  }
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });

const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "PATCH", body: JSON.stringify(body) });

import type { OtpChannel, OtpCodes } from "../navigation/types";

interface OtpResponse {
  channels: OtpChannel[];
  devCodes: OtpCodes;
}

export const api = {
  // --- Authentification ---
  register: (input: {
    email: string;
    phone: string;
    fullName?: string;
    locale: string;
  }) => post<{ userId: string } & OtpResponse>("/auth/register", input),

  login: (email: string) =>
    post<{ userId: string } & OtpResponse>("/auth/login", { email }),

  resendOtp: (userId: string) =>
    post<OtpResponse>("/auth/resend-otp", { userId }),

  verifyOtp: (userId: string, emailCode: string, smsCode?: string) =>
    post<{ token: string; user: User }>("/auth/verify-otp", {
      userId,
      emailCode,
      smsCode,
    }),

  /** `timeoutMs` sert au démarrage : on n'y attend pas 12 s avant la connexion. */
  me: (timeoutMs?: number) => request<User>("/me", {}, timeoutMs),

  updateProfile: (input: Partial<Pick<User, "fullName" | "locale">>) =>
    patch<User>("/me", input),

  // --- Catalogue ---
  troncons: () => request<Trancon[]>("/troncons"),

  vehicles: (params: { city?: string; type?: VehicleType }) => {
    const query = new URLSearchParams();
    if (params.city) query.set("city", params.city);
    if (params.type) query.set("type", params.type);
    return request<Vehicle[]>(`/vehicles?${query.toString()}`);
  },

  // --- Réservations ---
  bookFrontalier: (input: {
    tranconId: string;
    departureAt: string;
    isRoundTrip: boolean;
    seats: number;
    pickupAddress: string;
    pickupLat?: number;
    pickupLng?: number;
  }) =>
    post<{ booking: Booking; price: PriceBreakdown }>(
      "/bookings/frontalier",
      input
    ),

  bookLocation: (input: {
    vehicleId: string;
    startAt: string;
    durationDays: number;
    pickupAddress: string;
    pickupLat?: number;
    pickupLng?: number;
  }) =>
    post<{ booking: Booking; price: PriceBreakdown; advanceFcfa: number }>(
      "/bookings/location-ville",
      input
    ),

  bookings: () => request<Booking[]>("/bookings"),

  booking: (id: string) => request<Booking>(`/bookings/${id}`),

  cancelBooking: (id: string, reason?: string) =>
    post<Booking>(`/bookings/${id}/cancel`, { reason }),

  rateBooking: (id: string, score: number, comment?: string) =>
    post<{ id: string; score: number }>(`/bookings/${id}/rating`, {
      score,
      comment,
    }),

  // --- Paiement ---
  initiatePayment: (input: {
    bookingId: string;
    method: string;
    payFull?: boolean;
    /** Numéro Mobile Money qui recevra la demande de validation. */
    phone?: string;
  }) =>
    post<{
      payment: Payment;
      dueNowFcfa?: number;
      /** CONFIRMED : réglé en espèces. PENDING : en attente de validation. */
      status: "CONFIRMED" | "PENDING";
    }>("/payments/initiate", input),

  paymentStatus: (id: string) =>
    request<{ status: "PENDING" | "ESCROW_HELD" | "FAILED" }>(
      `/payments/${id}/status`
    ),

  // --- Appels dans l'application ---
  callsEnabled: () =>
    request<{ enabled: boolean; phoneMasked: boolean }>("/calls/config"),

  startCall: (bookingId: string) =>
    post<{ call: Call; credentials: CallCredentials }>("/calls", { bookingId }),

  incomingCall: () => request<IncomingCall | null>("/calls/incoming"),

  acceptCall: (id: string) =>
    post<{ credentials: CallCredentials }>(`/calls/${id}/accept`),

  declineCall: (id: string) => post<{ ok: boolean }>(`/calls/${id}/decline`),

  endCall: (id: string) => post<{ ok: boolean }>(`/calls/${id}/end`),

  callStatus: (id: string) => request<Call>(`/calls/${id}`),

  // --- Chauffeur ---
  driverRegister: (input: {
    baseCity: string;
    offersFrontalier: boolean;
    offersLocationVille: boolean;
  }) => post<{ id: string }>("/driver/register", input),

  /** Retire une candidature chauffeur : le compte redevient un compte client. */
  driverCancelRegistration: () =>
    request<{ ok: boolean }>("/driver/register", { method: "DELETE" }),

  driverMe: () => request<DriverProfile>("/driver/me"),

  driverSetOnline: (isOnline: boolean) =>
    patch<{ isOnline: boolean }>("/driver/status", { isOnline }),

  uploadImage,

  driverUploadDocument: (type: string, fileUrl: string) =>
    post<{ missingDocuments: string[] }>("/driver/documents", { type, fileUrl }),

  driverAddVehicle: (input: {
    type: VehicleType;
    plateNumber: string;
    seats: number;
    brand?: string;
    model?: string;
    color?: string;
    pricePerDay?: number;
  }) => post<Vehicle>("/driver/vehicles", input),

  driverRemoveVehicle: (id: string) =>
    request<{ ok: boolean }>(`/driver/vehicles/${id}`, { method: "DELETE" }),

  driverAvailableRides: () => request<DriverRide[]>("/driver/rides/available"),

  driverRides: () => request<DriverRide[]>("/driver/rides"),

  driverAccept: (id: string, vehicleId?: string) =>
    post<DriverRide>(`/driver/rides/${id}/accept`, vehicleId ? { vehicleId } : {}),

  driverStart: (id: string) => post<{ ok: boolean }>(`/driver/rides/${id}/start`),

  driverComplete: (id: string) =>
    post<{ ok: boolean; earningsFcfa: number }>(`/driver/rides/${id}/complete`),

  driverWithdraw: (amountFcfa: number, destination: string) =>
    post<{ id: string; status: string }>("/driver/withdrawals", {
      amountFcfa,
      destination,
    }),
};
