import { useState } from "react";
import { Alert, Linking, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ChoiceGroup } from "../components/ChoiceGroup";
import { Notice } from "../components/Feedback";
import { Screen } from "../components/Screen";
import { TextField } from "../components/TextField";
import { useSession } from "../auth/SessionProvider";
import { useI18n, type Locale } from "../i18n";
import { useTheme } from "../theme";
import { api } from "../api/client";

export default function ProfileScreen() {
  const { colors, radius, space, text } = useTheme();
  const { t, locale, setLocale } = useI18n();
  const { user, signOut, refresh } = useSession();

  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setNotice(null);
    try {
      await api.updateProfile({ fullName, locale });
      await refresh();
      setNotice(t("profile.saved"));
    } catch {
      setNotice(t("common.genericError"));
    } finally {
      setSaving(false);
    }
  }

  /** La langue change immédiatement à l'écran, et suit le compte côté serveur. */
  function handleLocale(next: Locale) {
    setLocale(next);
    api.updateProfile({ locale: next }).catch(() => {});
  }

  function confirmSignOut() {
    Alert.alert(t("profile.signOutConfirm"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("profile.signOut"), style: "destructive", onPress: signOut },
    ]);
  }

  return (
    <Screen scroll>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[4] }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: radius.pill,
            backgroundColor: colors.brand,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={[text.title, { color: colors.onBrand }]}>
            {(user?.fullName ?? user?.email ?? "?").charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1, gap: space[1] }}>
          <Text style={[text.heading, { color: colors.text }]}>
            {user?.fullName ?? user?.email}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons
              name={user?.emailVerified ? "checkmark-circle" : "alert-circle"}
              size={14}
              color={user?.emailVerified ? colors.success : colors.warning}
            />
            <Text style={[text.caption, { color: colors.textMuted }]}>
              {user?.emailVerified ? t("profile.verified") : t("profile.notVerified")}
            </Text>
          </View>
        </View>
      </View>

      <Card>
        <Text style={[text.label, { color: colors.textMuted }]}>
          {t("profile.personalInfo")}
        </Text>
        <TextField
          label={t("auth.fullName")}
          value={fullName}
          onChangeText={setFullName}
          placeholder={t("auth.fullNamePlaceholder")}
        />
        <View style={{ gap: space[1], marginTop: space[2] }}>
          <Text style={[text.caption, { color: colors.textFaint }]}>
            {t("auth.email")} · {user?.email}
          </Text>
          <Text style={[text.caption, { color: colors.textFaint }]}>
            {t("auth.phone")} · {user?.phone}
          </Text>
        </View>
        <Button label={t("common.save")} onPress={handleSave} loading={saving} />
      </Card>

      <ChoiceGroup
        label={t("profile.language")}
        options={[
          { value: "fr", label: t("profile.french") },
          { value: "en", label: t("profile.english") },
        ]}
        value={locale}
        onChange={handleLocale}
      />

      {notice ? (
        <Notice
          message={notice}
          tone={notice === t("profile.saved") ? "success" : "error"}
        />
      ) : null}

      <Card onPress={() => Linking.openURL("mailto:support@frontiride.com")}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
          <Ionicons name="help-buoy" size={20} color={colors.brand} />
          <View style={{ flex: 1 }}>
            <Text style={[text.subheading, { color: colors.text }]}>
              {t("profile.support")}
            </Text>
            <Text style={[text.caption, { color: colors.textMuted }]}>
              {t("profile.supportBody")}
            </Text>
          </View>
        </View>
      </Card>

      <Button
        label={t("profile.signOut")}
        variant="secondary"
        onPress={confirmSignOut}
      />

      <Text
        style={[text.caption, { color: colors.textFaint, textAlign: "center" }]}
      >
        {t("profile.version", {
          version: Constants.expoConfig?.version ?? "0.1.0",
        })}
      </Text>
    </Screen>
  );
}
