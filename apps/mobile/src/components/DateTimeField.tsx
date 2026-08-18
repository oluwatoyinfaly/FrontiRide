import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";

interface DateTimeFieldProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  /** Propose aussi l'heure après la date (départ d'une course frontalière). */
  withTime?: boolean;
  minimumDate?: Date;
}

export function DateTimeField({
  label,
  value,
  onChange,
  withTime = false,
  minimumDate,
}: DateTimeFieldProps) {
  const { colors, radius, space, text } = useTheme();
  const { formatDate } = useI18n();
  const [mode, setMode] = useState<"date" | "time" | null>(null);

  function handleChange(event: { type: string }, picked?: Date) {
    // Android ferme le sélecteur à chaque étape ; iOS le garde ouvert.
    const dismissed = event.type === "dismissed";
    if (dismissed || !picked) {
      setMode(null);
      return;
    }

    onChange(picked);

    if (Platform.OS === "android" && mode === "date" && withTime) {
      setMode("time");
    } else {
      setMode(null);
    }
  }

  return (
    <View style={{ gap: space[2] }}>
      <Text style={[text.label, { color: colors.textMuted }]}>{label}</Text>

      <Pressable
        onPress={() => setMode("date")}
        accessibilityRole="button"
        style={({ pressed }) => ({
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          paddingHorizontal: space[4],
          paddingVertical: space[4],
          minHeight: 52,
          justifyContent: "center",
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={[text.body, { color: colors.text }]}>
          {formatDate(value, withTime)}
        </Text>
      </Pressable>

      {mode ? (
        <DateTimePicker
          value={value}
          mode={mode}
          minimumDate={minimumDate}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleChange}
        />
      ) : null}
    </View>
  );
}
