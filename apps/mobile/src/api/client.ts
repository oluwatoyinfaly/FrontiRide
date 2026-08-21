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

/** Port de l'API, hors des ports de développement usuels (voir README). */
const API_PORT = 47001;

/**
 * URL du backend. En développement on vise par défaut la machine qui sert
 * Metro : c'est presque toujours celle qui fait aussi tourner l'API, et ça
 * évite d'avoir à retenir l'adresse IP locale sur téléphone réel.
 */
function defaultApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured;

  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return host ? `http://${host}:${API_PORT}` : `http://localhost:${API_PORT}`;
}

export const API_URL = defaultApiUrl();

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

/** Erreur d'API portant le code HTTP, pour distinguer 409 de 500 côté écran. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
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
        (payload as { error?: string } | null)?.error ?? response.statusText
      );
    }

    return payload as T;
  } finally {
    clearTimeout(timer);
  }
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });

const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "PATCH", body: JSON.stringify(body) });

type OtpCodes = { email: string; sms: string } | null;

export const api = {
  // --- Authentification ---
  register: (input: {
    email: string;
    phone: string;
    fullName?: string;
    locale: string;
  }) => post<{ userId: string; devCodes: OtpCodes }>("/auth/register", input),

  login: (email: string) =>
    post<{ userId: string; devCodes: OtpCodes }>("/auth/login", { email }),

  resendOtp: (userId: string) =>
    post<{ devCodes: OtpCodes }>("/auth/resend-otp", { userId }),

  verifyOtp: (userId: string, emailCode: string, smsCode: string) =>
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
  }) =>
    post<{ booking: Booking; price: PriceBreakdown }>(
      "/bookings/frontalier",
      input
    ),

  bookLocation: (input: {
    vehicleId: string;
    startAt: string;
    durationDays: number;
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
  }) =>
    post<{ payment: Payment; dueNowFcfa?: number; paymentUrl: string | null }>(
      "/payments/initiate",
      input
    ),

  // --- Appels dans l'application ---
  callsEnabled: () => request<{ enabled: boolean }>("/calls/config"),

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

  driverUploadDocument: (type: string, fileUrl: string) =>
    post<{ missingDocuments: string[] }>("/driver/documents", { type, fileUrl }),

  driverAddVehicle: (input: {
    type: VehicleType;
    plateNumber: string;
    seats: number;
    brand?: string;
    model?: string;
    pricePerDay?: number;
  }) => post<Vehicle>("/driver/vehicles", input),

  driverAvailableRides: () => request<DriverRide[]>("/driver/rides/available"),

  driverRides: () => request<DriverRide[]>("/driver/rides"),

  driverAccept: (id: string) => post<DriverRide>(`/driver/rides/${id}/accept`),

  driverStart: (id: string) => post<{ ok: boolean }>(`/driver/rides/${id}/start`),

  driverComplete: (id: string) =>
    post<{ ok: boolean; earningsFcfa: number }>(`/driver/rides/${id}/complete`),

  driverWithdraw: (amountFcfa: number, destination: string) =>
    post<{ id: string; status: string }>("/driver/withdrawals", {
      amountFcfa,
      destination,
    }),
};
