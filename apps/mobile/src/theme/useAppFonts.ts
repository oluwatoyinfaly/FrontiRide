import { useFonts } from "expo-font";

/**
 * Charge la face de titrage de la charte. Le texte courant reste sur la pile
 * système, donc l'app est utilisable même si ce chargement échoue.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    "Archivo-Bold": require("../../assets/fonts/Archivo-Bold.ttf"),
    "Archivo-SemiBold": require("../../assets/fonts/Archivo-SemiBold.ttf"),
  });

  return loaded || error !== null;
}
