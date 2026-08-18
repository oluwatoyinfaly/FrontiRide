import type { BookingType } from "@prisma/client";

const ALPHABET = "0123456789";

/**
 * Référence lisible d'une réservation : FR-4821 (frontalier), LV-9037 (location).
 * Volontairement courte — elle est dictée au téléphone et au poste-frontière.
 */
export function bookingReference(type: BookingType): string {
  const prefix = type === "FRONTALIER" ? "FR" : "LV";
  let digits = "";
  for (let i = 0; i < 4; i += 1) {
    digits += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${prefix}-${digits}`;
}
