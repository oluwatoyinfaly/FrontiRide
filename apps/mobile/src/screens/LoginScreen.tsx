import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../navigation/types";
import { Button } from "../components/Button";
import { Notice } from "../components/Feedback";
import { Screen } from "../components/Screen";
import { TextField } from "../components/TextField";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { ApiError, api } from "../api/client";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const { colors, radius, space, text } = useTheme();
  const { t, locale } = useI18n();

  const [mode, setMode] = useState<"signUp" | "signIn">("signUp");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignUp = mode === "signUp";
  const canSubmit = isSignUp ? Boolean(email && phone) : Boolean(email);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const result = isSignUp
        ? await api.register({
            email: email.trim(),
            phone: phone.trim(),
            fullName: fullName.trim() || undefined,
            locale,
          })
        : await api.login(email.trim());

      navigation.navigate("Otp", {
        userId: result.userId,
        email: email.trim(),
        devCodes: result.devCodes,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        setError(t("common.networkError"));
      } else if (err instanceof ApiError && err.status === 404) {
        setError(t("auth.noAccount"));
      } else if (err instanceof ApiError && err.status === 409) {
        setError(t("auth.phoneTaken"));
      } else {
        setError(t("auth.registerFailed"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen centered scroll edges={["top", "bottom"]}>
      <View style={{ gap: space[4], marginBottom: space[2] }}>
        <Image
          source={require("../../assets/icon.png")}
          accessibilityIgnoresInvertColors
          style={{ width: 72, height: 72, borderRadius: radius.lg }}
        />
        <View style={{ gap: space[2] }}>
          <Text style={[text.title, { color: colors.text }]}>
            {t("auth.welcomeTitle")}
          </Text>
          <Text style={[text.body, { color: colors.textMuted }]}>
            {t("auth.welcomeSubtitle")}
          </Text>
        </View>
      </View>

      <TextField
        label={t("auth.email")}
        placeholder={t("auth.emailPlaceholder")}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      {isSignUp ? (
        <>
          <TextField
            label={t("auth.phone")}
            placeholder={t("auth.phonePlaceholder")}
            autoComplete="tel"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          <TextField
            label={t("auth.fullName")}
            placeholder={t("auth.fullNamePlaceholder")}
            autoComplete="name"
            value={fullName}
            onChangeText={setFullName}
          />
        </>
      ) : null}

      {error ? <Notice message={error} tone="error" /> : null}

      <Button
        label={isSignUp ? t("auth.createAccount") : t("common.continue")}
        onPress={handleSubmit}
        loading={loading}
        disabled={!canSubmit}
      />

      <Pressable
        onPress={() => {
          setMode(isSignUp ? "signIn" : "signUp");
          setError(null);
        }}
        accessibilityRole="button"
        style={{ paddingVertical: space[3], alignItems: "center" }}
      >
        <Text style={[text.label, { color: colors.brand }]}>
          {isSignUp ? t("auth.signIn") : t("auth.createAccount")}
        </Text>
      </Pressable>
    </Screen>
  );
}
