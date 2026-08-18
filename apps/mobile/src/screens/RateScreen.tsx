import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { TripsStackParamList } from "../navigation/types";
import { Button } from "../components/Button";
import { Notice } from "../components/Feedback";
import { Screen } from "../components/Screen";
import { TextField } from "../components/TextField";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { ApiError, api } from "../api/client";

type Props = NativeStackScreenProps<TripsStackParamList, "Rate">;

export default function RateScreen({ route, navigation }: Props) {
  const { bookingId, driverName } = route.params;
  const { colors, space, text } = useTheme();
  const { t } = useI18n();

  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await api.rateBooking(bookingId, score, comment.trim() || undefined);
      navigation.goBack();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? t("trips.alreadyRated")
          : t("common.genericError")
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll>
      <Text style={[text.title, { color: colors.text }]}>
        {t("trips.rateTitle")}
      </Text>
      <Text style={[text.body, { color: colors.textMuted }]}>
        {t("trips.rateSubtitle", { name: driverName })}
      </Text>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          gap: space[2],
          paddingVertical: space[4],
        }}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => setScore(n)}
            accessibilityRole="radio"
            accessibilityState={{ selected: n === score }}
            accessibilityLabel={`${n} / 5`}
            hitSlop={6}
          >
            <Ionicons
              name={n <= score ? "star" : "star-outline"}
              size={40}
              color={colors.accent}
            />
          </Pressable>
        ))}
      </View>

      <TextField
        label={t("trips.rateComment")}
        value={comment}
        onChangeText={setComment}
        multiline
        numberOfLines={4}
        style={{ minHeight: 100, textAlignVertical: "top" }}
      />

      {error ? <Notice message={error} tone="error" /> : null}

      <Button
        label={t("trips.rateSubmit")}
        onPress={handleSubmit}
        loading={submitting}
      />
    </Screen>
  );
}
