import { Alert, Text, View } from "react-native";
import { Button } from "./Button";
import { Card } from "./Card";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { hasCoordinates, openDirections, wazeUrl, type Pickup } from "../lib/maps";

/**
 * Lieu de rendez-vous. Côté chauffeur, il propose l'itinéraire dans Google
 * Maps (et Waze quand on a les coordonnées) ; côté client, il rappelle ce qui
 * a été communiqué.
 */
export function PickupCard({
  pickup,
  navigable = false,
}: {
  pickup: Pickup;
  navigable?: boolean;
}) {
  const { colors, space, text } = useTheme();
  const { t } = useI18n();

  if (!pickup.address) return null;

  async function go(app: "google" | "waze") {
    try {
      await openDirections(pickup, app);
    } catch {
      Alert.alert(t("pickup.openFailed"));
    }
  }

  return (
    <Card>
      <Text style={[text.label, { color: colors.textMuted }]}>{t("pickup.title")}</Text>
      <Text style={[text.subheading, { color: colors.text }]}>{pickup.address}</Text>
      {hasCoordinates(pickup) ? (
        <Text style={[text.caption, { color: colors.textFaint }]}>
          {t("pickup.hasPosition")}
        </Text>
      ) : null}
      {navigable ? (
        <View style={{ gap: space[2] }}>
          <Button label={t("pickup.go")} onPress={() => go("google")} />
          {wazeUrl(pickup) ? (
            <Button label={t("pickup.goWaze")} variant="secondary" onPress={() => go("waze")} />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}
