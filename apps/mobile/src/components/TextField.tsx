import { useState } from "react";
import { TextInput, Text, View, type TextInputProps } from "react-native";
import { useTheme } from "../theme";

interface TextFieldProps extends TextInputProps {
  label: string;
}

export function TextField({ label, style, ...inputProps }: TextFieldProps) {
  const { colors, radius, space, text } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: space[2] }}>
      <Text style={[text.label, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textFaint}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          text.body,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderWidth: focused ? 2 : 1,
            borderColor: focused ? colors.brand : colors.border,
            borderRadius: radius.md,
            paddingHorizontal: space[4],
            // compense l'épaisseur de bordure au focus pour éviter un saut
            paddingVertical: focused ? space[3] - 1 : space[3],
            minHeight: 52,
          },
          style,
        ]}
        {...inputProps}
      />
    </View>
  );
}
