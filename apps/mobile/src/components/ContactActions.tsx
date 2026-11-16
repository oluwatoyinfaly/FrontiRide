import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCall } from "../calls/CallProvider";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { callPhone, openWhatsApp, whatsappNumber } from "../lib/contact";

/** Vert officiel de WhatsApp : le canal doit se reconnaître sans le lire. */
const WHATSAPP_GREEN = "#25D366";

interface ContactActionsProps {
  /** Course concernée : c'est elle qui autorise l'appel dans l'application. */
  bookingId: string;
  phone: string;
  name?: string | null;
  /** Message pré-rempli dans la conversation WhatsApp. */
  message?: string;
  /**
   * Sur une course frontalière, l'un des deux est à l'étranger : l'appel
   * téléphonique part en itinérance. On le dit plutôt que de le laisser
   * découvrir sur la facture.
   */
  crossBorder?: boolean;
}

/**
 * Les trois façons de joindre l'autre partie, de la moins chère à la plus
 * chère : appel dans l'application (données, gratuit), WhatsApp (données),
 * puis l'appel téléphonique classique, en dernier.
 */
export function ContactActions({
  bookingId,
  phone,
  name,
  message,
  crossBorder = false,
}: ContactActionsProps) {
  const { colors, radius, space, text } = useTheme();
  const { t } = useI18n();
  const { available: canVoip, serverEnabled, nativeSupported, call } = useCall();

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
      Alert.alert(t("contact.callFailed"));
    }
  }

  return (
    <View style={{ gap: space[2] }}>
      {canVoip ? (
        <Row
          icon="wifi"
          tint={colors.brand}
          title={t("contact.appCall")}
          hint={t("contact.appCallHint")}
          onPress={() => call(bookingId, name ?? null)}
        />
      ) : null}

      {/* Le serveur sait appeler mais pas cette version de l'app : on le dit.
          Une option qui disparaît sans explication passe pour une panne. */}
      {!canVoip && serverEnabled && !nativeSupported ? (
        <Row
          icon="wifi"
          quiet
          title={t("contact.appCall")}
          hint={t("contact.appCallNeedsBuild")}
          onPress={() => Alert.alert(t("contact.appCall"), t("contact.appCallNeedsBuildBody"))}
        />
      ) : null}

      {canWhatsApp ? (
        <Row
          icon="logo-whatsapp"
          tint={WHATSAPP_GREEN}
          title={t("contact.whatsapp")}
          hint={t("contact.whatsappHint")}
          disabled={busy}
          onPress={handleWhatsApp}
        />
      ) : null}

      {/* Dernier recours, et il en a l'allure : pastille sobre plutôt que
          pleine couleur, qui manquerait de contraste en thème sombre. */}
      <Row
        icon="call"
        quiet
        title={t("contact.call")}
        hint={crossBorder ? t("contact.callHintRoaming") : t("contact.callHint")}
        onPress={handleCall}
      />
    </View>
  );

  function Row({
    icon,
    tint,
    title,
    hint,
    onPress,
    disabled = false,
    quiet = false,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    tint?: string;
    title: string;
    hint: string;
    onPress: () => void;
    disabled?: boolean;
    quiet?: boolean;
  }) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: space[3],
          paddingVertical: space[3],
          paddingHorizontal: space[3],
          borderRadius: radius.md,
          backgroundColor: colors.surfaceMuted,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        })}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: quiet ? colors.surface : tint,
            borderWidth: quiet ? 1 : 0,
            borderColor: colors.border,
          }}
        >
          <Ionicons
            name={icon}
            size={18}
            color={quiet ? colors.textMuted : "#FFFFFF"}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[text.label, { color: colors.text }]}>{title}</Text>
          <Text style={[text.caption, { color: colors.textFaint }]}>{hint}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
      </Pressable>
    );
  }
}
