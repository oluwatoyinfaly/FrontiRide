import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "../theme";

interface ButtonProps {
  label: string;
  onPress: () => void;
  /**
   * primary : l'action principale. secondary : une action de même poids mais
   * secondaire. ghost : un retour en arrière, sans cadre. danger : une action
   * destructrice, dont la couleur doit prévenir avant le clic.
   */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
}: ButtonProps) {
  const { colors, radius, space, text } = useTheme();
  const isPrimary = variant === "primary";
  const isGhost = variant === "ghost";
  const isDanger = variant === "danger";
  const inactive = disabled || loading;

  const labelColor = isPrimary
    ? colors.onBrand
    : isDanger
      ? colors.danger
      : isGhost
        ? colors.textMuted
        : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          paddingVertical: space[4],
          paddingHorizontal: space[5],
          borderRadius: radius.md,
          backgroundColor: isPrimary
            ? colors.brand
            : isGhost
              ? "transparent"
              : colors.surface,
          borderWidth: isPrimary || isGhost ? 0 : 1,
          borderColor: isDanger ? colors.danger : colors.border,
          opacity: inactive ? 0.45 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.onBrand : labelColor} />
      ) : (
        <Text style={[text.subheading, { color: labelColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center", minHeight: 52 },
});
