import { Pressable, Text, View } from "react-native";
import { useTheme } from "../theme";

export interface Choice<T extends string> {
  value: T;
  label: string;
}

interface ChoiceGroupProps<T extends string> {
  label: string;
  options: readonly Choice<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: ChoiceGroupProps<T>) {
  const { colors, radius, space, text } = useTheme();

  return (
    <View style={{ gap: space[2] }}>
      <Text style={[text.label, { color: colors.textMuted }]}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={({ pressed }) => ({
                paddingHorizontal: space[4],
                paddingVertical: space[3],
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: selected ? colors.brand : colors.border,
                backgroundColor: selected ? colors.brand : colors.surface,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={[
                  text.label,
                  { color: selected ? colors.onBrand : colors.text },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
