import { useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../navigation/types";
import { Button } from "../components/Button";
import { Notice } from "../components/Feedback";
import { Screen } from "../components/Screen";
import { TextField } from "../components/TextField";
import { useSession } from "../auth/SessionProvider";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { ApiError, api } from "../api/client";

type Props = NativeStackScreenProps<AuthStackParamList, "Otp">;

export default function OtpScreen({ route }: Props) {
  const { userId, email, devCodes } = route.params;
  const { colors, space, text } = useTheme();
  const { t } = useI18n();
  const { signIn } = useSession();

  const [emailCode, setEmailCode] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Hors production le backend renvoie les codes : on les préremplit pour
  // pouvoir dérouler le parcours sans passerelle SMS.
  useEffect(() => {
    if (devCodes) {
      setEmailCode(devCodes.email);
      setSmsCode(devCodes.sms);
    }
  }, [devCodes]);

  async function handleVerify() {
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await api.verifyOtp(userId, emailCode, smsCode);
      await signIn(token, user);
      // Pas de navigation ici : le navigateur racine bascule tout seul sur
      // l'app dès que la session existe.
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 0
          ? t("common.networkError")
          : t("auth.invalidCode")
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    try {
      const { devCodes: fresh } = await api.resendOtp(userId);
      if (fresh) {
        setEmailCode(fresh.email);
        setSmsCode(fresh.sms);
      }
      setInfo(t("auth.resent"));
    } catch {
      setError(t("common.genericError"));
    }
  }

  return (
    <Screen scroll>
      <Text style={[text.body, { color: colors.textMuted }]}>
        {t("auth.otpSubtitle", { email })}
      </Text>

      {devCodes ? (
        <Text style={[text.caption, { color: colors.warning }]}>
          {t("auth.devCodesHint")}
        </Text>
      ) : null}

      <TextField
        label={t("auth.emailCode")}
        placeholder={t("auth.sixDigits")}
        keyboardType="number-pad"
        maxLength={6}
        value={emailCode}
        onChangeText={setEmailCode}
      />

      <TextField
        label={t("auth.smsCode")}
        placeholder={t("auth.sixDigits")}
        keyboardType="number-pad"
        maxLength={6}
        value={smsCode}
        onChangeText={setSmsCode}
      />

      {error ? <Notice message={error} tone="error" /> : null}
      {info && !error ? <Notice message={info} tone="success" /> : null}

      <Button
        label={t("auth.verify")}
        onPress={handleVerify}
        loading={loading}
        disabled={emailCode.length !== 6 || smsCode.length !== 6}
      />

      <Pressable
        onPress={handleResend}
        accessibilityRole="button"
        style={{ paddingVertical: space[3], alignItems: "center" }}
      >
        <Text style={[text.label, { color: colors.brand }]}>
          {t("auth.resend")}
        </Text>
      </Pressable>
    </Screen>
  );
}
