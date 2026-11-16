import { Linking } from "react-native";

/**
 * Ouverture des canaux de contact entre client et chauffeur.
 *
 * Le corridor est international : le client est au Bénin (+229), le chauffeur
 * au Togo (+228) ou l'inverse. Un appel classique part alors en itinérance et
 * se facture à la minute, quand WhatsApp passe par les données. C'est pourquoi
 * WhatsApp est mis en avant sur les courses frontalières.
 */

/**
 * wa.me n'accepte qu'une suite de chiffres au format international, sans « + »
 * ni séparateur. Un numéro local (sans indicatif) ne peut pas être joint depuis
 * l'étranger : on le rejette plutôt que d'ouvrir une conversation vide.
 */
export function whatsappNumber(phone: string): string | null {
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (!cleaned.startsWith("+")) return null;
  const international = cleaned.slice(1);
  return international.length >= 8 ? international : null;
}

/** Lien d'appel téléphonique classique. */
export function telUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export async function callPhone(phone: string): Promise<void> {
  await Linking.openURL(telUrl(phone));
}

/**
 * Ouvre la conversation WhatsApp, message pré-rempli. WhatsApp n'expose pas de
 * lien qui décroche directement : depuis la conversation, l'appel est à un
 * bouton — c'est le chemin le plus court que la plateforme permette.
 *
 * Renvoie false si le numéro n'est pas exploitable. Sinon on tente d'abord le
 * schéma natif (l'app installée), puis wa.me, qui retombe sur le navigateur ou
 * propose l'installation.
 */
export async function openWhatsApp(
  phone: string,
  message?: string
): Promise<boolean> {
  const number = whatsappNumber(phone);
  if (!number) return false;

  const query = message ? `&text=${encodeURIComponent(message)}` : "";

  try {
    const native = `whatsapp://send?phone=${number}${query}`;
    if (await Linking.canOpenURL(native)) {
      await Linking.openURL(native);
      return true;
    }
  } catch {
    // canOpenURL échoue si le schéma n'est pas déclaré : on passe au lien web.
  }

  // Sur Android 11+, canOpenURL renvoie false pour un schéma non déclaré dans
  // <queries>, même WhatsApp installé. Le lien wa.me n'en souffre pas : c'est
  // un lien d'application vérifié, que le système ouvre dans WhatsApp quand
  // elle est là, et dans le navigateur sinon.

  await Linking.openURL(
    `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ""}`
  );
  return true;
}
