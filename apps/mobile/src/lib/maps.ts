import { Linking, Platform } from "react-native";

/**
 * Itinéraire vers le point de rendez-vous, dans l'application de cartes du
 * téléphone. Pas de carte intégrée : Google Maps, Waze ou Apple Plans sont déjà
 * installés, connaissent le trafic local, et ne demandent ni clé d'API payante
 * ni abonnement.
 */

export interface Pickup {
  address: string | null;
  lat: number | null;
  lng: number | null;
}

/** Destination : coordonnées exactes si on les a, sinon le texte saisi. */
function destination(p: Pickup): string {
  return p.lat !== null && p.lng !== null
    ? `${p.lat},${p.lng}`
    : encodeURIComponent(p.address ?? "");
}

export function googleMapsUrl(p: Pickup): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${destination(p)}&travelmode=driving`;
}

/** Waze n'ouvre un itinéraire sûr qu'avec des coordonnées. */
export function wazeUrl(p: Pickup): string | null {
  if (p.lat === null || p.lng === null) return null;
  return `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`;
}

export async function openDirections(
  p: Pickup,
  app: "google" | "waze" = "google"
): Promise<void> {
  const waze = app === "waze" ? wazeUrl(p) : null;
  await Linking.openURL(waze ?? googleMapsUrl(p));
}

export const hasCoordinates = (p: Pickup) => p.lat !== null && p.lng !== null;

/** Pour mémoire : le lien https de Google Maps s'ouvre dans l'app sur iOS comme Android. */
export const mapsPlatform = Platform.OS;
