import { useState } from "react";
import { Image, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { Button } from "../components/Button";
import { Screen } from "../components/Screen";
import { TextField } from "../components/TextField";
import { useTheme } from "../theme";
import { api } from "../api/client";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const { colors, radius, space, text } = useTheme();
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
      setError("Inscription impossible. Vérifiez votre email et votre numéro.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen centered scroll edges={["top", "bottom"]}>
      <View style={{ gap: space[4], marginBottom: space[4] }}>
        <Image
          source={require("../../assets/icon.png")}
          accessibilityIgnoresInvertColors
          style={{ width: 76, height: 76, borderRadius: radius.lg }}
        />
        <View style={{ gap: space[2] }}>
          <Text style={[text.title, { color: colors.text }]}>
            Bienvenue sur FrontiRide
          </Text>
          <Text style={[text.body, { color: colors.textMuted }]}>
            Le transport frontalier et de séjour, simple et sécurisé.
          </Text>
        </View>
      </View>

      <TextField
        label="Email"
        placeholder="vous@exemple.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextField
        label="Téléphone"
        placeholder="+229 ..."
        autoComplete="tel"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />

      {error ? (
        <Text style={[text.caption, { color: colors.danger }]}>{error}</Text>
      ) : null}

      <Button
        label="Continuer"
        onPress={handleSubmit}
        loading={loading}
        disabled={!email || !phone}
      />
    </Screen>
  );
}
