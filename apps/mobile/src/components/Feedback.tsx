import { ActivityIndicator, Text, View } from "react-native";
import { useTheme } from "../theme";

/** Ligne clé/valeur d'un récapitulatif. */
export function InfoRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  const { colors, text } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
      }}
    >
      <Text style={[text.body, { color: colors.textMuted, flexShrink: 1 }]}>
        {label}
      </Text>
      <Text
        style={[
          emphasis ? text.amount : text.body,
          { color: emphasis ? colors.brand : colors.text, textAlign: "right" },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  const { colors, space, text } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: space[3], paddingVertical: space[8] }}>
      <ActivityIndicator color={colors.brand} />
      {label ? (
        <Text style={[text.caption, { color: colors.textMuted }]}>{label}</Text>
      ) : null}
    </View>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  const { colors, space, text } = useTheme();
  return (
    <View
      style={{
        alignItems: "center",
        gap: space[2],
        paddingVertical: space[10],
        paddingHorizontal: space[6],
      }}
    >
      <Text style={[text.subheading, { color: colors.text, textAlign: "center" }]}>
        {title}
      </Text>
      {hint ? (
        <Text style={[text.body, { color: colors.textMuted, textAlign: "center" }]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** Message de résultat d'action : vert si succès, rouge si échec. */
export function Notice({ message, tone }: { message: string; tone: "success" | "error" }) {
  const { colors, radius, space, text } = useTheme();
  const color = tone === "success" ? colors.success : colors.danger;

  return (
    <View
      style={{
        backgroundColor: `${color}14`,
        borderColor: color,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: space[4],
      }}
    >
      <Text style={[text.body, { color }]}>{message}</Text>
    </View>
  );
}
