import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { callPhone, openWhatsApp, whatsappNumber } from "../lib/contact";

/** Vert officiel de WhatsApp : le bouton doit se reconnaître sans le lire. */
const WHATSAPP_GREEN = "#25D366";

interface ContactActionsProps {
  phone: string;
  /** Nom affiché dans la confirmation d'erreur, jamais dans le message. */
  name?: string | null;
  /** Message pré-rempli dans la conversation WhatsApp. */
  message?: string;
  /**
   * Sur une course frontalière, l'un des deux est à l'étranger : l'appel part
   * en itinérance, WhatsApp passe par les données. On met alors WhatsApp en
   * premier, et on le dit.
   */
  crossBorder?: boolean;
}

export function ContactActions({
  phone,
  name,
  message,
  crossBorder = false,
}: ContactActionsProps) {
  const { colors, radius, space, text } = useTheme();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  const canWhatsApp = whatsappNumber(phone) !== null;

  async function handleWhatsApp() {
    setBusy(true);
    try {
      const opened = await openWhatsApp(phone, message);
      if (!opened) Alert.alert(t("contact.whatsappUnavailable"));
    } catch {
      Alert.alert(t("contact.whatsappUnavailable"));
    } finally {
      setBusy(false);
    }
  }

  async function handleCall() {
    try {
      await callPhone(phone);
    } catch {
      Alert.alert(t("contact.callFailed", { name: name ?? "" }));
    }
  }

  const whatsapp = (
    <Pressable
      key="whatsapp"
      onPress={handleWhatsApp}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={t("contact.whatsapp")}
      style={({ pressed }) => [
        styles.action,
        {
          borderRadius: radius.md,
          paddingVertical: space[3],
          backgroundColor: WHATSAPP_GREEN,
          opacity: pressed || busy ? 0.85 : 1,
        },
      ]}
    >
      <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
      <Text style={[text.label, { color: "#FFFFFF" }]}>
        {t("contact.whatsapp")}
      </Text>
    </Pressable>
  );

  const call = (
    <Pressable
      key="call"
      onPress={handleCall}
      accessibilityRole="button"
      accessibilityLabel={t("contact.call")}
      style={({ pressed }) => [
        styles.action,
        {
          borderRadius: radius.md,
          paddingVertical: space[3],
          // surfaceMuted et non surface : ce bouton est posé sur une carte
          // déjà en surface, où il disparaîtrait — surtout en thème sombre.
          backgroundColor: colors.surfaceMuted,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Ionicons name="call" size={16} color={colors.text} />
      <Text style={[text.label, { color: colors.text }]}>
        {t("contact.call")}
      </Text>
    </Pressable>
  );

  return (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: "row", gap: space[2] }}>
        {canWhatsApp && crossBorder ? [whatsapp, call] : null}
        {canWhatsApp && !crossBorder ? [call, whatsapp] : null}
        {canWhatsApp ? null : call}
      </View>

      {canWhatsApp && crossBorder ? (
        <Text style={[text.caption, { color: colors.textFaint }]}>
          {t("contact.roamingHint")}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 44,
  },
});
