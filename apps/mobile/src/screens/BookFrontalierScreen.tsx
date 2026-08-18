import { useEffect, useState } from "react";
import { View, Text, Switch, Pressable, StyleSheet } from "react-native";
import { api } from "../api/client";

interface Trancon {
  id: string;
  originCity: string;
  destinationCity: string;
  borderPoint: string | null;
  priceFcfa: number;
  estimatedCustomsFeeFcfa: number;
}

// MVP : un seul trançon actif (Cotonou <-> Lomé), pas de sélection libre
// d'itinéraire pour l'instant — voir docs/plan-de-developpement.md.
export default function BookFrontalierScreen() {
  const [troncons, setTroncons] = useState<Trancon[]>([]);
  const [selected, setSelected] = useState<Trancon | null>(null);
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [seats, setSeats] = useState(1);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    api
      .listTroncons()
      .then((data) => {
        const list = data as unknown as Trancon[];
        setTroncons(list);
        setSelected(list[0] ?? null);
      })
      .catch(() => setStatus("Impossible de charger les trançons."));
  }, []);

  const estimatedPrice = selected
    ? (selected.priceFcfa + selected.estimatedCustomsFeeFcfa) *
      (isRoundTrip ? 2 : 1)
    : 0;

  async function handleBook() {
    if (!selected) return;
    setStatus("Réservation en cours...");
    try {
      await api.bookFrontalier({
        tranconId: selected.id,
        departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        isRoundTrip,
        seats,
      });
      setStatus("Réservation créée. Passez au paiement.");
    } catch {
      setStatus("Erreur lors de la réservation.");
    }
  }

  return (
    <View style={styles.container}>
      {selected ? (
        <>
          <Text style={styles.route}>
            {selected.originCity} → {selected.destinationCity}
          </Text>
          {selected.borderPoint ? (
            <Text style={styles.subtitle}>
              Passage frontière : {selected.borderPoint}
            </Text>
          ) : null}

          <View style={styles.row}>
            <Text>Aller-retour</Text>
            <Switch value={isRoundTrip} onValueChange={setIsRoundTrip} />
          </View>

          <View style={styles.row}>
            <Text>Places : {seats}</Text>
            <View style={styles.seatButtons}>
              <Pressable
                onPress={() => setSeats((s) => Math.max(1, s - 1))}
                style={styles.seatButton}
              >
                <Text>-</Text>
              </Pressable>
              <Pressable
                onPress={() => setSeats((s) => Math.min(4, s + 1))}
                style={styles.seatButton}
              >
                <Text>+</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.price}>
            Prix estimé : {estimatedPrice.toLocaleString("fr-FR")} FCFA
          </Text>

          <Pressable style={styles.button} onPress={handleBook}>
            <Text style={styles.buttonText}>Réserver</Text>
          </Pressable>
        </>
      ) : (
        <Text>Chargement des trançons...</Text>
      )}

      {status ? <Text style={styles.status}>{status}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16 },
  route: { fontSize: 20, fontWeight: "700", color: "#0F172A" },
  subtitle: { fontSize: 14, color: "#64748B" },
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
  price: { fontSize: 18, fontWeight: "600", color: "#0F172A" },
  button: {
    backgroundColor: "#0F172A",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  buttonText: { color: "white", fontSize: 16, fontWeight: "600" },
  status: { color: "#475569" },
});
