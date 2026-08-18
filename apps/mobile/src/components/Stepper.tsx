import { Pressable, Text, View } from "react-native";
import { useTheme } from "../theme";

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

export function Stepper({ label, value, min, max, onChange }: StepperProps) {
  const { colors, radius, space, text } = useTheme();

  function step(delta: number) {
    onChange(Math.min(max, Math.max(min, value + delta)));
  }

  const button = (symbol: string, delta: number, disabled: boolean) => (
    <Pressable
      onPress={() => step(delta)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={delta > 0 ? `Augmenter ${label}` : `Diminuer ${label}`}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
      })}
    >
      <Text style={[text.heading, { color: colors.text }]}>{symbol}</Text>
    </Pressable>
  );

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: space[4],
      }}
    >
      <Text style={[text.label, { color: colors.textMuted, flexShrink: 1 }]}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        {button("−", -1, value <= min)}
        <Text
          style={[text.amount, { color: colors.text, minWidth: 28, textAlign: "center" }]}
        >
          {value}
        </Text>
        {button("+", 1, value >= max)}
      </View>
    </View>
  );
}
