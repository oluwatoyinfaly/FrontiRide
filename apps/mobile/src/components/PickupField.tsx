import { useState } from "react";
import { Text, View } from "react-native";
import * as Location from "expo-location";
import { Button } from "./Button";
import { TextField } from "./TextField";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";

export interface PickupValue {
  address: string;
  lat?: number;
  lng?: number;
}

/**
 * Où le chauffeur doit venir chercher le client. Le texte est obligatoire : un
 * repère que tout le monde comprend (« devant l'hôtel X, porte B »). La
 * position GPS est un plus, prise une seule fois sur demande — jamais suivie —
 * et sert à ouvrir l'itinéraire exact dans l'application de cartes.
 */
export function PickupField({
  value,
  onChange,
}: {
  value: PickupValue;
  onChange: (next: PickupValue) => void;
}) {
  const { colors, text, space } = useTheme();
  const { t } = useI18n();
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function useMyPosition() {
    setMessage(null);
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setMessage(t("pickup.permissionDenied"));
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      onChange({
        ...value,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    } catch {
      setMessage(t("pickup.locateFailed"));
    } finally {
      setLocating(false);
    }
  }

  const hasPosition = value.lat !== undefined && value.lng !== undefined;

  return (
    <View style={{ gap: space[2] }}>
      <TextField
        label={t("pickup.label")}
        value={value.address}
        onChangeText={(address) => onChange({ ...value, address })}
        placeholder={t("pickup.placeholder")}
        maxLength={200}
      />
      <Button
        label={hasPosition ? t("pickup.positionSaved") : t("pickup.usePosition")}
        variant="secondary"
        loading={locating}
        onPress={useMyPosition}
      />
      <Text style={[text.caption, { color: message ? colors.danger : colors.textFaint }]}>
        {message ?? t("pickup.hint")}
      </Text>
    </View>
  );
}
