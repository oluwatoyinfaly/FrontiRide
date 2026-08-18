import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { api, setAuthToken } from "../api/client";

type Props = NativeStackScreenProps<RootStackParamList, "Otp">;

// MVP : deux codes distincts (email + SMS) doivent être validés avant
// que le compte soit considéré comme vérifié côté backend.
export default function OtpScreen({ route, navigation }: Props) {
  const { userId, email } = route.params;
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
    <View style={styles.container}>
      <Text style={styles.subtitle}>
        Codes envoyés à {email} et par SMS.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Code Email (6 chiffres)"
        keyboardType="number-pad"
        maxLength={6}
        value={emailCode}
        onChangeText={setEmailCode}
      />
      <TextInput
        style={styles.input}
        placeholder="Code SMS (6 chiffres)"
        keyboardType="number-pad"
        maxLength={6}
        value={smsCode}
        onChangeText={setSmsCode}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={styles.button}
        onPress={handleVerify}
        disabled={loading || emailCode.length !== 6 || smsCode.length !== 6}
      >
        <Text style={styles.buttonText}>
          {loading ? "Vérification..." : "Valider"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", gap: 12 },
  subtitle: { fontSize: 14, color: "#475569", marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#0F172A",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "white", fontSize: 16, fontWeight: "600" },
  error: { color: "#DC2626" },
});
