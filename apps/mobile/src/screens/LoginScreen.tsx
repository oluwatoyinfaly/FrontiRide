import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { api } from "../api/client";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const { userId } = await api.register(email, phone);
      navigation.navigate("Otp", { userId, email });
    } catch {
      setError("Impossible de vous inscrire. Vérifiez vos informations.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bienvenue sur FrontiRide</Text>
      <Text style={styles.subtitle}>
        Le transport frontalier et de séjour, simple et sécurisé.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Téléphone (+229...)"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={styles.button}
        onPress={handleSubmit}
        disabled={loading || !email || !phone}
      >
        <Text style={styles.buttonText}>
          {loading ? "Envoi..." : "Continuer"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", gap: 12 },
  title: { fontSize: 24, fontWeight: "700", color: "#0F172A" },
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
