import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Updates from "expo-updates";
import { useCall } from "../calls/CallProvider";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";

/** Au retour au premier plan, on ne réinterroge pas plus souvent que ça. */
const CHECK_EVERY_MS = 30 * 60 * 1000;

/**
 * Mises à jour à distance (EAS Update).
 *
 * Le JavaScript publié avec `npm run ota:*` est téléchargé en arrière-plan, au
 * lancement puis au retour dans l'application. Il s'appliquerait de lui-même au
 * prochain démarrage à froid ; ce bandeau propose de l'appliquer tout de suite.
 * Jamais d'autorité : redémarrer en pleine course ou en plein appel ferait
 * perdre l'écran en cours, c'est donc l'utilisateur qui choisit le moment.
 *
 * Inactif en développement (Expo Go, Metro) : `Updates.isEnabled` est faux.
 */
export function UpdateBanner() {
  const { colors, radius, space, text } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { state: call } = useCall();

  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const lastCheck = useRef(0);
  const checking = useRef(false);

  const check = useCallback(async () => {
    if (!Updates.isEnabled || __DEV__ || checking.current) return;
    if (Date.now() - lastCheck.current < CHECK_EVERY_MS) return;
    checking.current = true;
    lastCheck.current = Date.now();
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        const fetched = await Updates.fetchUpdateAsync();
        if (fetched.isNew) {
          setReady(true);
          setDismissed(false);
        }
      }
    } catch {
      // Hors ligne, serveur injoignable : on réessaiera au prochain retour.
      // L'application continue sur la version qu'elle a.
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener("change", (s) => s === "active" && check());
    return () => sub.remove();
  }, [check]);

  if (!ready || dismissed || call.phase !== "idle") return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: space[4],
        right: space[4],
        bottom: insets.bottom + space[4] + 56,
      }}
    >
      <View
        accessibilityRole="alert"
        style={{
          backgroundColor: colors.text,
          borderRadius: radius.md,
          padding: space[3],
          flexDirection: "row",
          alignItems: "center",
          gap: space[3],
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 6,
        }}
      >
        <Text style={[text.label, { color: colors.ground, flex: 1 }]}>
          {t("update.ready")}
        </Text>
        <Pressable onPress={() => setDismissed(true)} accessibilityRole="button" hitSlop={8}>
          <Text style={[text.label, { color: colors.ground, opacity: 0.7 }]}>
            {t("update.later")}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => Updates.reloadAsync().catch(() => setDismissed(true))}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={[text.label, { color: colors.accent }]}>{t("update.restart")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** « 0.1.0 · a1b2c3d » : ce qu'un utilisateur lit au support pour dire quelle version il a. */
export function versionLabel(appVersion: string | undefined): string {
  const id = Updates.updateId;
  const ota = id && !Updates.isEmbeddedLaunch ? ` · ${id.slice(0, 7)}` : "";
  return `${appVersion ?? "?"}${ota}`;
}
