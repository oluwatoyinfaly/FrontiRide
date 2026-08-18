import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Loading, Notice } from "../components/Feedback";
import { Screen } from "../components/Screen";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { api } from "../api/client";
import type { DocumentType, DriverProfile } from "../api/types";

const REQUIRED: DocumentType[] = [
  "CNI",
  "PERMIS",
  "CARTE_GRISE",
  "ASSURANCE",
  "VISITE_TECHNIQUE",
  "CASIER_JUDICIAIRE",
  "PHOTO_VEHICULE",
];

export default function DriverDocumentsScreen() {
  const { colors, space, text } = useTheme();
  const { t } = useI18n();

  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [busy, setBusy] = useState<DocumentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.driverMe().then(setProfile).catch(() => setError(t("common.networkError")));
  }, [t]);

  useFocusEffect(useCallback(() => load(), [load]));

  if (!profile) {
    return (
      <Screen>{error ? <Notice message={error} tone="error" /> : <Loading />}</Screen>
    );
  }

  async function pickAndUpload(type: DocumentType) {
    setError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(t("common.genericError"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (result.canceled) return;

    setBusy(type);
    try {
      // Le téléversement vers le stockage objet reste à brancher : on
      // enregistre pour l'instant l'URI locale renvoyée par le sélecteur, ce
      // qui suffit à faire avancer le dossier côté back-office.
      await api.driverUploadDocument(type, result.assets[0].uri);
      load();
    } catch {
      setError(t("common.genericError"));
    } finally {
      setBusy(null);
    }
  }

  const uploaded = new Set(profile.documents.map((d) => d.type));

  return (
    <Screen scroll>
      <Text style={[text.body, { color: colors.textMuted }]}>
        {profile.missingDocuments.length === 0
          ? t("driver.documentsComplete")
          : t("driver.documentsMissing", { count: profile.missingDocuments.length })}
      </Text>

      {error ? <Notice message={error} tone="error" /> : null}

      {REQUIRED.map((type) => {
        const done = uploaded.has(type);
        const doc = profile.documents.find((d) => d.type === type);

        return (
          <Card key={type}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}
            >
              <Ionicons
                name={done ? "checkmark-circle" : "ellipse-outline"}
                size={22}
                color={done ? colors.success : colors.textFaint}
              />
              <View style={{ flex: 1 }}>
                <Text style={[text.subheading, { color: colors.text }]}>
                  {t(`documentType.${type}`)}
                </Text>
                {doc ? (
                  <Text
                    style={[
                      text.caption,
                      {
                        color:
                          doc.status === "APPROVED"
                            ? colors.success
                            : doc.status === "REJECTED"
                              ? colors.danger
                              : colors.warning,
                      },
                    ]}
                  >
                    {doc.status === "APPROVED"
                      ? t("driver.statusApproved")
                      : doc.status === "REJECTED"
                        ? t("driver.statusRejected")
                        : t("driver.statusPendingReview")}
                  </Text>
                ) : null}
              </View>
            </View>

            <Button
              label={done ? t("driver.replace") : t("driver.upload")}
              variant="secondary"
              loading={busy === type}
              onPress={() => pickAndUpload(type)}
            />
          </Card>
        );
      })}
    </Screen>
  );
}
