import { useState } from "react";
import { Text } from "react-native";
import { Button } from "../components/Button";
import { ChoiceGroup, type Choice } from "../components/ChoiceGroup";
import { Screen } from "../components/Screen";
import { Stepper } from "../components/Stepper";
import { useTheme } from "../theme";
import { api } from "../api/client";

type City = "Cotonou" | "Lomé";
type VehicleType = "ECONOMIQUE" | "CONFORT" | "SUV" | "PREMIUM" | "MINIBUS";

const CITIES: readonly Choice<City>[] = [
  { value: "Cotonou", label: "Cotonou" },
  { value: "Lomé", label: "Lomé" },
];

const VEHICLE_TYPES: readonly Choice<VehicleType>[] = [
  { value: "ECONOMIQUE", label: "Économique" },
  { value: "CONFORT", label: "Confort" },
  { value: "SUV", label: "SUV / 4x4" },
  { value: "PREMIUM", label: "Premium" },
  { value: "MINIBUS", label: "Minibus" },
];

const fcfa = (amount: number) => `${amount.toLocaleString("fr-FR")} FCFA`;

// MVP : location à la journée uniquement (ni forfait horaire, ni forfait spécial).
export default function BookLocationVilleScreen() {
  const { colors, space, text } = useTheme();
  const [city, setCity] = useState<City>("Cotonou");
  const [vehicleType, setVehicleType] = useState<VehicleType>("ECONOMIQUE");
  const [durationDays, setDurationDays] = useState(1);
  const [booking, setBooking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function handleBook() {
    setBooking(true);
    setFailed(false);
    setStatus(null);
    try {
      const result = (await api.bookLocationVille({
        city,
        vehicleType,
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        durationDays,
      })) as { advanceFcfa: number };
      setStatus(
        `Réservation créée. Acompte de 30 % à régler : ${fcfa(result.advanceFcfa)}.`
      );
    } catch {
      setFailed(true);
      setStatus("Aucun véhicule disponible pour ces critères.");
    } finally {
      setBooking(false);
    }
  }

  return (
    <Screen scroll>
      <ChoiceGroup label="Ville" options={CITIES} value={city} onChange={setCity} />

      <ChoiceGroup
        label="Type de véhicule"
        options={VEHICLE_TYPES}
        value={vehicleType}
        onChange={setVehicleType}
      />

      <Stepper
        label="Durée (jours)"
        value={durationDays}
        min={1}
        max={30}
        onChange={setDurationDays}
      />

      <Text style={[text.caption, { color: colors.textMuted, marginTop: space[1] }]}>
        Le véhicule est bloqué dès le versement de l'acompte. Le solde se règle à la
        fin de la location, en Mobile Money, par carte ou en espèces au chauffeur.
      </Text>

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
