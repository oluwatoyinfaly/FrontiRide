import { useState } from "react";
import { Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ProfileStackParamList } from "../navigation/types";
import { Button } from "../components/Button";
import { ChoiceGroup } from "../components/ChoiceGroup";
import { Notice } from "../components/Feedback";
import { Screen } from "../components/Screen";
import { useSession } from "../auth/SessionProvider";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { api } from "../api/client";

type Props = NativeStackScreenProps<ProfileStackParamList, "BecomeDriver">;

/**
 * Candidature chauffeur, ouverte depuis le profil d'un compte client. Rien
 * n'est engageant : tant que le dossier n'a servi à aucune course, il se
 * retire d'un bouton depuis l'espace chauffeur.
 */
export default function BecomeDriverScreen({ navigation }: Props) {
  const { colors, space, text } = useTheme();
  const { t } = useI18n();
  const { refresh } = useSession();

  const [baseCity, setBaseCity] = useState("Cotonou");
  const [frontalier, setFrontalier] = useState(true);
  const [location, setLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await api.driverRegister({
        baseCity,
        offersFrontalier: frontalier,
        offersLocationVille: location,
      });
      // La session porte le profil chauffeur : c'est lui qui fait apparaître
      // l'onglet Chauffeur dans la barre de navigation.
      await refresh();
      navigation.goBack();
    } catch {
      setError(t("common.genericError"));
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll>
      <Ionicons name="car-sport" size={40} color={colors.brand} />
      <Text style={[text.title, { color: colors.text }]}>
        {t("driver.becomeTitle")}
      </Text>
      <Text style={[text.body, { color: colors.textMuted }]}>
        {t("driver.becomeBody")}
      </Text>

      <ChoiceGroup
        label={t("driver.baseCity")}
        options={[
          { value: "Cotonou", label: "Cotonou" },
          { value: "Lomé", label: "Lomé" },
        ]}
        value={baseCity}
        onChange={setBaseCity}
      />

      <Text style={[text.label, { color: colors.textMuted }]}>
        {t("driver.offers")}
      </Text>

      <ToggleRow
        label={t("driver.offerFrontalier")}
        value={frontalier}
        onChange={setFrontalier}
      />
      <ToggleRow
        label={t("driver.offerLocation")}
        value={location}
        onChange={setLocation}
      />

      {error ? <Notice message={error} tone="error" /> : null}

      <Button
        label={t("driver.becomeCta")}
        onPress={handleSubmit}
        loading={submitting}
        disabled={!frontalier && !location}
      />

      {/* Renoncer avant d'avoir envoyé quoi que ce soit : un simple retour. */}
      <Button
        label={t("common.cancel")}
        variant="ghost"
        onPress={() => navigation.goBack()}
        disabled={submitting}
      />

      <Text
        style={[
          text.caption,
          { color: colors.textFaint, textAlign: "center", marginTop: space[2] },
        ]}
      >
        {t("driver.becomeReversible")}
      </Text>
    </Screen>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const { colors, space, text } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: space[4],
      }}
    >
      <Text style={[text.body, { color: colors.text, flexShrink: 1 }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.brand }}
      />
    </View>
  );
}
