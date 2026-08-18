import { useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { Stepper } from "../components/Stepper";
import { useTheme } from "../theme";
import { api } from "../api/client";

interface Trancon {
  id: string;
  originCity: string;
  destinationCity: string;
  borderPoint: string | null;
  priceFcfa: number;
  estimatedCustomsFeeFcfa: number;
}

const fcfa = (amount: number) => `${amount.toLocaleString("fr-FR")} FCFA`;

// MVP : un seul trançon actif (Cotonou <-> Lomé), pas de sélection libre
// d'itinéraire — voir docs/plan-de-developpement.md.
export default function BookFrontalierScreen() {
  const { colors, space, text } = useTheme();
  const [trancon, setTrancon] = useState<Trancon | null>(null);
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [seats, setSeats] = useState(1);
  const [booking, setBooking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .listTroncons()
      .then((data) => setTrancon((data as unknown as Trancon[])[0] ?? null))
      .catch(() => {
        setFailed(true);
        setStatus("Impossible de charger les trajets disponibles.");
      });
  }, []);

  const multiplier = isRoundTrip ? 2 : 1;
  const basePrice = trancon ? trancon.priceFcfa * multiplier : 0;
  const customsFee = trancon ? trancon.estimatedCustomsFeeFcfa * multiplier : 0;

  async function handleBook() {
    if (!trancon) return;
    setBooking(true);
    setFailed(false);
    setStatus(null);
    try {
      await api.bookFrontalier({
        tranconId: trancon.id,
        departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        isRoundTrip,
        seats,
      });
      setStatus("Réservation créée. Vous pouvez passer au paiement.");
    } catch {
      setFailed(true);
      setStatus("La réservation n'a pas pu être enregistrée. Réessayez.");
    } finally {
      setBooking(false);
    }
  }

  if (!trancon) {
    return (
      <Screen>
        <Text style={[text.body, { color: failed ? colors.danger : colors.textMuted }]}>
          {status ?? "Chargement des trajets…"}
        </Text>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={{ gap: space[1] }}>
        <Text style={[text.title, { color: colors.text }]}>
          {trancon.originCity} → {trancon.destinationCity}
        </Text>
        {trancon.borderPoint ? (
          <Text style={[text.body, { color: colors.textMuted }]}>
            Passage par {trancon.borderPoint}
          </Text>
        ) : null}
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: space[4],
        }}
      >
        <Text style={[text.label, { color: colors.textMuted }]}>Aller-retour</Text>
        <Switch
          value={isRoundTrip}
          onValueChange={setIsRoundTrip}
          trackColor={{ false: colors.border, true: colors.brand }}
        />
      </View>

      <Stepper
        label="Nombre de places"
        value={seats}
        min={1}
        max={4}
        onChange={setSeats}
      />

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={[text.body, { color: colors.textMuted }]}>Trajet</Text>
          <Text style={[text.body, { color: colors.text }]}>{fcfa(basePrice)}</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={[text.body, { color: colors.textMuted }]}>
            Frais de douane estimés
          </Text>
          <Text style={[text.body, { color: colors.text }]}>{fcfa(customsFee)}</Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: space[3],
            marginTop: space[1],
          }}
        >
          <Text style={[text.subheading, { color: colors.text }]}>Prix estimé</Text>
          <Text style={[text.amount, { color: colors.brand }]}>
            {fcfa(basePrice + customsFee)}
          </Text>
        </View>
      </Card>

      <Button label="Réserver" onPress={handleBook} loading={booking} />

      {status ? (
        <Text
          style={[text.caption, { color: failed ? colors.danger : colors.success }]}
        >
          {status}
        </Text>
      ) : null}
    </Screen>
  );
}
