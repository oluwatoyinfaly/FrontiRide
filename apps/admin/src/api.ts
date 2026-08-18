export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

const TOKEN_KEY = "frontiride.admin.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, "Serveur injoignable.");
  }

  if (response.status === 401) {
    setToken(null);
    // Le jeton n'est plus valable : on renvoie l'admin sur l'écran de connexion.
    window.location.reload();
    throw new ApiError(401, "Session expirée");
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      (payload as { error?: string } | null)?.error ?? response.statusText
    );
  }

  return payload as T;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });

// --- Types renvoyés par l'API ---

export interface Stats {
  drivers: { pendingReview: number; approved: number };
  bookings: Record<string, number>;
  revenue: { completedCount: number; totalFcfa: number; thisMonthFcfa: number };
  escrow: { count: number; amountFcfa: number };
  pendingWithdrawals: number;
  topTroncons: {
    count: number;
    trancon: { originCity: string; destinationCity: string } | null;
  }[];
}

export interface AdminDriver {
  id: string;
  status: string;
  isOnline: boolean;
  baseCity: string | null;
  ratingAverage: number;
  offersFrontalier: boolean;
  offersLocationVille: boolean;
  createdAt: string;
  user: { fullName: string | null; email: string; phone: string };
  documents: { id: string; type: string; status: string; fileUrl: string }[];
  vehicles: {
    id: string;
    type: string;
    brand: string | null;
    model: string | null;
    plateNumber: string;
    pricePerDay: number | null;
  }[];
  wallet: { balanceFcfa: number; pendingFcfa: number } | null;
  _count: { bookings: number };
}

export interface AdminBooking {
  id: string;
  reference: string;
  type: string;
  status: string;
  departureAt: string | null;
  startAt: string | null;
  createdAt: string;
  estimatedPriceFcfa: number | null;
  finalPriceFcfa: number | null;
  client: { fullName: string | null; email: string; phone: string };
  driver: { id: string; user: { fullName: string | null } } | null;
  trancon: { originCity: string; destinationCity: string } | null;
  payment: { id: string; status: string; method: string } | null;
}

export interface AdminPayment {
  id: string;
  method: string;
  status: string;
  amountFcfa: number;
  advanceFcfa: number | null;
  escrowReleaseAt: string | null;
  createdAt: string;
  booking: {
    reference: string;
    type: string;
    status: string;
    client: { fullName: string | null };
    driver: { id: string; user: { fullName: string | null } } | null;
  };
}

export interface AdminWithdrawal {
  id: string;
  amountFcfa: number;
  status: string;
  destination: string;
  createdAt: string;
  wallet: { driver: { user: { fullName: string | null; phone: string } } };
}

export interface Trancon {
  id: string;
  originCity: string;
  destinationCity: string;
  borderPoint: string | null;
  priceFcfa: number;
  estimatedCustomsFeeFcfa: number;
  active: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
}

export const api = {
  login: (email: string) =>
    post<{ userId: string; devCodes: { email: string; sms: string } | null }>(
      "/auth/login",
      { email }
    ),

  verifyOtp: (userId: string, emailCode: string, smsCode: string) =>
    post<{ token: string; user: AdminUser }>("/auth/verify-otp", {
      userId,
      emailCode,
      smsCode,
    }),

  me: () => request<AdminUser>("/me"),

  stats: () => request<Stats>("/admin/stats"),

  drivers: (status?: string) =>
    request<AdminDriver[]>(
      `/admin/drivers${status ? `?status=${status}` : ""}`
    ),

  approveDriver: (id: string) => post(`/admin/drivers/${id}/approve`),
  rejectDriver: (id: string) => post(`/admin/drivers/${id}/reject`),
  suspendDriver: (id: string) => post(`/admin/drivers/${id}/suspend`),

  bookings: (status?: string) =>
    request<AdminBooking[]>(
      `/admin/bookings${status ? `?status=${status}` : ""}`
    ),

  disputeBooking: (id: string) => post(`/admin/bookings/${id}/dispute`),

  payments: (status?: string) =>
    request<AdminPayment[]>(
      `/admin/payments${status ? `?status=${status}` : ""}`
    ),

  releasePayment: (id: string) =>
    post<{ releasedFcfa: number }>(`/admin/payments/${id}/release`),
  refundPayment: (id: string) => post(`/admin/payments/${id}/refund`),

  withdrawals: () => request<AdminWithdrawal[]>("/admin/withdrawals"),
  settleWithdrawal: (id: string) => post(`/admin/withdrawals/${id}/settle`),

  troncons: () => request<Trancon[]>("/admin/troncons"),
  createTrancon: (body: Omit<Trancon, "id">) => post<Trancon>("/admin/troncons", body),
  updateTrancon: (id: string, body: Partial<Trancon>) =>
    request<Trancon>(`/admin/troncons/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};

// --- Formatage ---

export const fcfa = (amount: number) =>
  `${new Intl.NumberFormat("fr-FR").format(amount)} FCFA`;

export const shortDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "—";

export const dateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "—";
