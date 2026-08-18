import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { api } from "../api/client";

const CITIES = ["Cotonou", "Lomé"] as const;
const VEHICLE_TYPES = ["ECONOMIQUE", "CONFORT", "SUV", "PREMIUM", "MINIBUS"] as const;

// MVP : location à la journée uniquement (pas "à l'heure" ni forfaits spéciaux).
export default function BookLocationVilleScreen() {
  const [city, setCity] = useState<(typeof CITIES)[number]>("Cotonou");
  const [vehicleType, setVehicleType] =
    useState<(typeof VEHICLE_TYPES)[number]>("ECONOMIQUE");
  const [durationDays, setDurationDays] = useState(1);
  const [status, setStatus] = useState<string | null>(null);

  async function handleBook() {
    setStatus("Recherche d'un véhicule disponible...");
    try {
      const result = (await api.bookLocationVille({
        city,
        vehicleType,
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        durationDays,
      })) as { advanceFcfa: number };
      setStatus(
        `Réservation créée. Acompte à payer : ${result.advanceFcfa.toLocaleString(
          "fr-FR"
        )} FCFA (30%).`
      );
    } catch {
      setStatus("Aucun véhicule disponible pour ces critères.");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Ville</Text>
      <View style={styles.choices}>
        {CITIES.map((c) => (
          <Pressable
            key={c}
            style={[styles.choice, city === c && styles.choiceActive]}
            onPress={() => setCity(c)}
          >
            <Text style={city === c ? styles.choiceTextActive : styles.choiceText}>
              {c}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Type de véhicule</Text>
      <View style={styles.choices}>
        {VEHICLE_TYPES.map((v) => (
          <Pressable
            key={v}
            style={[styles.choice, vehicleType === v && styles.choiceActive]}
            onPress={() => setVehicleType(v)}
          >
            <Text
              style={vehicleType === v ? styles.choiceTextActive : styles.choiceText}
            >
              {v}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Durée (jours) : {durationDays}</Text>
        <View style={styles.seatButtons}>
          <Pressable
            onPress={() => setDurationDays((d) => Math.max(1, d - 1))}
            style={styles.seatButton}
          >
            <Text>-</Text>
          </Pressable>
          <Pressable
            onPress={() => setDurationDays((d) => Math.min(30, d + 1))}
            style={styles.seatButton}
          >
            <Text>+</Text>
          </Pressable>
        </View>
      </View>

      <Pressable style={styles.button} onPress={handleBook}>
        <Text style={styles.buttonText}>Réserver</Text>
      </Pressable>

      {status ? <Text style={styles.status}>{status}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  label: { fontSize: 14, fontWeight: "600", color: "#0F172A", marginTop: 8 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  choiceActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  choiceText: { color: "#0F172A" },
  choiceTextActive: { color: "white" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  seatButtons: { flexDirection: "row", gap: 8 },
  seatButton: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  button: {
    backgroundColor: "#0F172A",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 16,
  },
  buttonText: { color: "white", fontSize: 16, fontWeight: "600" },
  status: { color: "#475569" },
});
