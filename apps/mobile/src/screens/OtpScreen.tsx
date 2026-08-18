import { useState } from "react";
import { Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { Button } from "../components/Button";
import { Screen } from "../components/Screen";
import { TextField } from "../components/TextField";
import { useTheme } from "../theme";
import { api, setAuthToken } from "../api/client";

type Props = NativeStackScreenProps<RootStackParamList, "Otp">;

// Les deux codes (email + SMS) doivent être validés avant que le compte
// soit considéré comme vérifié côté backend.
export default function OtpScreen({ route, navigation }: Props) {
  const { userId, email } = route.params;
  const { colors, space, text } = useTheme();
  const [emailCode, setEmailCode] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    setError(null);
    setLoading(true);
    try {
      await api.verifyOtp(userId, "email", emailCode);
      const result = await api.verifyOtp(userId, "sms", smsCode);
      if (result.verified && result.token) {
        setAuthToken(result.token);
        navigation.reset({ index: 0, routes: [{ name: "Home" }] });
      } else {
        setError("Les deux codes doivent être valides.");
      }
    } catch {
      setError("Code invalide ou expiré.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll>
      <Text style={[text.body, { color: colors.textMuted, marginBottom: space[2] }]}>
        Deux codes vous ont été envoyés : un à {email}, un par SMS.
      </Text>

      <TextField
        label="Code reçu par email"
        placeholder="6 chiffres"
        keyboardType="number-pad"
        maxLength={6}
        value={emailCode}
        onChangeText={setEmailCode}
      />

      <TextField
        label="Code reçu par SMS"
        placeholder="6 chiffres"
        keyboardType="number-pad"
        maxLength={6}
        value={smsCode}
        onChangeText={setSmsCode}
      />

      {error ? (
        <Text style={[text.caption, { color: colors.danger }]}>{error}</Text>
      ) : null}

      <Button
        label="Valider"
        onPress={handleVerify}
        loading={loading}
        disabled={emailCode.length !== 6 || smsCode.length !== 6}
      />
    </Screen>
  );
}
