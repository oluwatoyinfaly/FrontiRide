// URL du backend Fastify. En dev, pointe vers la machine locale (adapter
// selon l'émulateur : 10.0.2.2 pour Android Studio, localhost pour iOS Simulator).
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  register: (email: string, phone: string) =>
    request<{ userId: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, phone }),
    }),

  verifyOtp: (userId: string, channel: "email" | "sms", code: string) =>
    request<{ verified: boolean; token?: string }>("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ userId, channel, code }),
    }),

  listTroncons: () => request<Array<Record<string, unknown>>>("/troncons"),

  bookFrontalier: (payload: {
    tranconId: string;
    departureAt: string;
    isRoundTrip: boolean;
    seats: number;
  }) =>
    request("/rides/frontalier", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  bookLocationVille: (payload: {
    city: "Cotonou" | "Lomé";
    vehicleType: string;
    startAt: string;
    durationDays: number;
  }) =>
    request("/rides/location-ville", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
