import { Prisma, type BookingType } from "@prisma/client";

/**
 * Référence lisible d'une réservation : FR-48213 (frontalier), LV-90372
 * (location). Volontairement courte — elle est dictée au téléphone et au
 * poste-frontière.
 */
export function bookingReference(type: BookingType): string {
  const prefix = type === "FRONTALIER" ? "FR" : "LV";
  const digits = String(Math.floor(Math.random() * 100000)).padStart(5, "0");
  return `${prefix}-${digits}`;
}

/** Violation de contrainte d'unicité sur la référence. */
function isReferenceCollision(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;
  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes("reference") : true;
}

/**
 * Crée une réservation en réessayant si la référence tirée est déjà prise.
 *
 * Une référence courte se heurte au paradoxe des anniversaires : sur 100 000
 * valeurs, une collision devient probable dès quelques centaines de courses.
 * Sans reprise, la création échouerait en erreur serveur devant le client.
 */
export async function createBookingWithReference<T>(
  create: (reference: string) => Promise<T>,
  type: BookingType,
  attempts = 5
): Promise<T> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await create(bookingReference(type));
    } catch (error) {
      if (attempt === attempts || !isReferenceCollision(error)) throw error;
    }
  }

  // Inatteignable : la boucle rend ou relance à la dernière tentative.
  throw new Error("Génération de référence impossible");
}
