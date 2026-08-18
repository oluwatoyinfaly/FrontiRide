import { Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { useTheme } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const { colors, space, text } = useTheme();

  return (
    <Screen scroll>
      <Text style={[text.title, { color: colors.text, marginBottom: space[2] }]}>
        Où allez-vous ?
      </Text>

      <Card onPress={() => navigation.navigate("BookFrontalier")}>
        <Text style={[text.heading, { color: colors.text }]}>
          Transport Frontalier
        </Text>
        <Text style={[text.body, { color: colors.textMuted }]}>
          Cotonou ↔ Lomé, via le poste d'Hilacondji.
        </Text>
      </Card>

      <Card onPress={() => navigation.navigate("BookLocationVille")}>
        <Text style={[text.heading, { color: colors.text }]}>
          Location avec Chauffeur
        </Text>
        <Text style={[text.body, { color: colors.textMuted }]}>
          À la journée, à Cotonou ou à Lomé.
        </Text>
      </Card>

      <View
        style={{
          backgroundColor: colors.surfaceMuted,
          borderRadius: 12,
          padding: space[4],
          marginTop: space[2],
        }}
      >
        <Text style={[text.caption, { color: colors.textMuted }]}>
          Tous les chauffeurs FrontiRide sont vérifiés : pièce d'identité, permis,
          carte grise, assurance et casier judiciaire contrôlés par notre équipe.
        </Text>
      </View>
    </Screen>
  );
}
