import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "../theme";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
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
  const inactive = disabled || loading;

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
          backgroundColor: isPrimary ? colors.brand : colors.surface,
          borderWidth: isPrimary ? 0 : 1,
          borderColor: colors.border,
          opacity: inactive ? 0.45 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.onBrand : colors.brand} />
      ) : (
        <Text
          style={[
            text.subheading,
            { color: isPrimary ? colors.onBrand : colors.text },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center", minHeight: 52 },
});
