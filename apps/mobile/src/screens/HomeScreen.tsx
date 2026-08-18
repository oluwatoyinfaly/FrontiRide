import { View, Text, Pressable, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Où allez-vous ?</Text>

      <Pressable
        style={styles.card}
        onPress={() => navigation.navigate("BookFrontalier")}
      >
        <Text style={styles.cardTitle}>Transport Frontalier</Text>
        <Text style={styles.cardSubtitle}>Cotonou ↔ Lomé (via Hilacondji)</Text>
      </Pressable>

      <Pressable
        style={styles.card}
        onPress={() => navigation.navigate("BookLocationVille")}
      >
        <Text style={styles.cardTitle}>Location avec Chauffeur</Text>
        <Text style={styles.cardSubtitle}>À la journée, Cotonou ou Lomé</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16 },
  title: { fontSize: 22, fontWeight: "700", color: "#0F172A", marginBottom: 8 },
  card: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    padding: 20,
  },
  cardTitle: { fontSize: 18, fontWeight: "600", color: "#0F172A" },
  cardSubtitle: { fontSize: 14, color: "#64748B", marginTop: 4 },
});
