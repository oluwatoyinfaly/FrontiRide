/**
 * Ce que chaque partie a le droit de voir d'une course.
 *
 * - Le numéro de l'autre partie disparaît quand l'admin a activé le masquage :
 *   le contact passe alors uniquement par l'appel dans l'application. Le
 *   masquage se fait ici, côté serveur — un client modifié ne peut pas le
 *   contourner, le numéro ne quitte jamais l'API.
 * - La photo du chauffeur n'est jamais une adresse publique : on renvoie la
 *   route authentifiée qui la sert, ou null s'il n'en a pas.
 */

type WithPhone = { phone?: string | null };

type DriverLike = {
  id: string;
  user: ({ fullName: string | null } & WithPhone) | null;
  documents?: { id: string }[];
};

export const photoPath = (driverId: string) => `/drivers/${driverId}/photo`;

export function withoutPhone<T extends WithPhone>(person: T, masked: boolean): T {
  if (!masked) return person;
  const { phone: _phone, ...rest } = person;
  return rest as T;
}

export function presentDriver<D extends DriverLike>(driver: D, masked: boolean) {
  const { documents, user, ...rest } = driver;
  return {
    ...rest,
    photoUrl: documents && documents.length > 0 ? photoPath(driver.id) : null,
    user: user ? withoutPhone(user, masked) : user,
  };
}

type BookingLike = {
  client?: ({ fullName: string | null } & WithPhone) | null;
  driver?: DriverLike | null;
};

/** Course vue par le client (ou l'admin) : le chauffeur est présenté, le numéro peut être masqué. */
export function presentBooking<B extends BookingLike>(booking: B, masked: boolean) {
  const { client, driver, ...rest } = booking;
  return {
    ...rest,
    client: client ? withoutPhone(client, masked) : client,
    driver: driver ? presentDriver(driver, masked) : driver,
  };
}

/** Le repère de prise en charge n'est dévoilé qu'au chauffeur qui a accepté. */
export function withoutPickup<
  T extends { pickupAddress?: unknown; pickupLat?: unknown; pickupLng?: unknown }
>(booking: T) {
  const { pickupAddress: _a, pickupLat: _b, pickupLng: _c, ...rest } = booking;
  return rest;
}
