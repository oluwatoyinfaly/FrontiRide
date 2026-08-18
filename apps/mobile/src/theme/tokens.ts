/**
 * Jetons de la charte FrontiRide.
 * Source unique des couleurs, rayons, espacements et styles de texte —
 * aucun écran ne doit écrire une valeur en dur.
 */
import type { TextStyle } from "react-native";

/** Couleurs de marque, invariantes d'un thème à l'autre. */
export const brandPalette = {
  /** Vert Frontière — couleur de marque. */
  green: "#0B6E52",
  /** Vert éclairci, pour rester lisible sur fond sombre. */
  greenLight: "#35A481",
  /** Vert Profond — fonds pleins, splash, barre de statut. */
  greenDeep: "#083F30",
  /** Ambre Harmattan — accent secondaire (FrontiPoints, badges). */
  amber: "#E0891A",
  amberLight: "#E0A048",
} as const;

export interface ThemeColors {
  brand: string;
  brandDeep: string;
  /** Texte et icônes posés sur `brand`. */
  onBrand: string;
  accent: string;

  ground: string;
  surface: string;
  /** Fonds discrets : champs inactifs, puces, séparateurs pleins. */
  surfaceMuted: string;

  text: string;
  textMuted: string;
  textFaint: string;
  border: string;

  success: string;
  warning: string;
  danger: string;
  info: string;
}

const lightColors: ThemeColors = {
  brand: brandPalette.green,
  brandDeep: brandPalette.greenDeep,
  onBrand: "#FFFFFF",
  accent: brandPalette.amber,

  ground: "#F2F5F3",
  surface: "#FFFFFF",
  surfaceMuted: "#E9EEEB",

  text: "#0F1613",
  textMuted: "#5A6C66",
  textFaint: "#8A9B95",
  border: "#D8E0DC",

  success: "#15803D",
  warning: "#B45309",
  danger: "#B91C1C",
  info: "#0E7490",
};

const darkColors: ThemeColors = {
  brand: brandPalette.greenLight,
  brandDeep: "#062A20",
  onBrand: "#04211A",
  accent: brandPalette.amberLight,

  ground: "#0B100E",
  surface: "#141B18",
  surfaceMuted: "#1C2521",

  text: "#E8EEEB",
  textMuted: "#97A8A2",
  textFaint: "#6C7D77",
  border: "#26302C",

  success: "#4ADE80",
  warning: "#FBBF24",
  danger: "#F87171",
  info: "#38BDF8",
};

export const colorSchemes = { light: lightColors, dark: darkColors };

/** Échelle d'espacement de base 4. */
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

/**
 * Familles de police. Archivo est chargée par `useAppFonts` ; le texte courant
 * reste sur la pile système, plus rapide au démarrage et déjà optimisée pour
 * le français comme pour l'anglais.
 */
export const fontFamily = {
  display: "Archivo-Bold",
  displaySemi: "Archivo-SemiBold",
} as const;

/** Styles de texte nommés, à utiliser plutôt qu'un fontSize arbitraire. */
export const textStyles = {
  title: { fontFamily: fontFamily.display, fontSize: 26, lineHeight: 31 },
  heading: { fontFamily: fontFamily.display, fontSize: 20, lineHeight: 25 },
  subheading: { fontFamily: fontFamily.displaySemi, fontSize: 16, lineHeight: 21 },
  body: { fontSize: 16, lineHeight: 23 },
  label: { fontFamily: fontFamily.displaySemi, fontSize: 14, lineHeight: 18 },
  caption: { fontSize: 13, lineHeight: 18 },
  /** Montants en FCFA et références de course : chiffres de largeur fixe. */
  amount: {
    fontFamily: fontFamily.display,
    fontSize: 20,
    lineHeight: 25,
    fontVariant: ["tabular-nums"],
  },
} satisfies Record<string, TextStyle>;
