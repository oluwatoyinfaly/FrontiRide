import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { useCall } from "./CallProvider";
import type { IncomingCall } from "../api/types";

/** Chaque fin d'appel a son mot : « refusé » n'est pas « pas de réponse ». */
const OUTCOME_KEY = {
  declined: "call.declined",
  missed: "call.missed",
  failed: "call.failed",
  ended: "call.ended",
} as const;

/** mm:ss, la seule durée qu'on lit d'un coup d'œil pendant un appel. */
function elapsed(since: number): string {
  const total = Math.floor((Date.now() - since) / 1000);
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/**
 * Écran d'appel, posé au-dessus de toute l'application : un appel prend la
 * main, il ne se glisse pas dans un coin d'écran.
 */
export function CallOverlay({ incoming }: { incoming: IncomingCall | null }) {
  const { colors, radius, space, text } = useTheme();
  const { t } = useI18n();
  const { state, hangUp, accept, decline, setMuted, setSpeaker } = useCall();

  const [muted, setMutedState] = useState(false);
  const [speaker, setSpeakerState] = useState(false);
  const [, tick] = useState(0);

  // Rafraîchit la durée affichée une fois par seconde, sans état superflu.
  useEffect(() => {
    if (state.phase !== "active") return;
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase === "idle") {
      setMutedState(false);
      setSpeakerState(false);
    }
  }, [state.phase]);

  const visible = state.phase !== "idle" || incoming !== null;
  if (!visible) return null;

  const isIncoming = incoming !== null && state.phase === "idle";
  const peer = isIncoming ? incoming.caller.fullName : state.peerName;

  const subtitle = isIncoming
    ? t("call.incoming", { reference: incoming.booking.reference })
    : state.phase === "outgoing"
      ? t("call.ringing")
      : state.phase === "active"
        ? elapsed(state.connectedAt ?? Date.now())
        : t(OUTCOME_KEY[state.outcome ?? "ended"]);

  return (
    <Modal visible animationType="fade" transparent={false} statusBarTranslucent>
      <View style={[styles.screen, { backgroundColor: colors.ground, padding: space[6] }]}>
        <View style={{ alignItems: "center", gap: space[3], marginTop: space[8] }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: radius.pill,
              backgroundColor: colors.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="person" size={44} color={colors.textMuted} />
          </View>
          <Text style={[text.title, { color: colors.text }]}>
            {peer ?? t("call.unknown")}
          </Text>
          <Text style={[text.body, { color: colors.textMuted }]}>{subtitle}</Text>
        </View>

        <View style={{ gap: space[5] }}>
          {state.phase === "active" ? (
            <View style={{ flexDirection: "row", justifyContent: "center", gap: space[6] }}>
              <Toggle
                icon={muted ? "mic-off" : "mic"}
                label={t("call.mute")}
                active={muted}
                onPress={() => {
                  const next = !muted;
                  setMutedState(next);
                  setMuted(next);
                }}
              />
              <Toggle
                icon="volume-high"
                label={t("call.speaker")}
                active={speaker}
                onPress={() => {
                  const next = !speaker;
                  setSpeakerState(next);
                  setSpeaker(next);
                }}
              />
            </View>
          ) : null}

          <View style={{ flexDirection: "row", justifyContent: "center", gap: space[8] }}>
            {isIncoming ? (
              <>
                <Round color={colors.danger} icon="close" onPress={decline} />
                <Round color={colors.success} icon="call" onPress={accept} />
              </>
            ) : state.phase === "ended" ? null : (
              <Round color={colors.danger} icon="call" rotate onPress={hangUp} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );

  function Toggle({
    icon,
    label,
    active,
    onPress,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    active: boolean;
    onPress: () => void;
  }) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" style={{ alignItems: "center", gap: 6 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: active ? colors.brand : colors.surfaceMuted,
          }}
        >
          <Ionicons name={icon} size={22} color={active ? colors.onBrand : colors.text} />
        </View>
        <Text style={[text.caption, { color: colors.textMuted }]}>{label}</Text>
      </Pressable>
    );
  }

  function Round({
    color,
    icon,
    onPress,
    rotate = false,
  }: {
    color: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    rotate?: boolean;
  }) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => ({
          width: 72,
          height: 72,
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: color,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Ionicons
          name={icon}
          size={30}
          color="#FFFFFF"
          style={rotate ? { transform: [{ rotate: "135deg" }] } : undefined}
        />
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "space-between" },
});
