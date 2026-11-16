import { useCallback, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ChoiceGroup } from "../components/ChoiceGroup";
import { EmptyState, Loading, Notice } from "../components/Feedback";
import { Screen } from "../components/Screen";
import { TextField } from "../components/TextField";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { ApiError, api } from "../api/client";
import type { DriverProfile, VehicleType } from "../api/types";

const TYPES: VehicleType[] = ["ECONOMIQUE", "CONFORT", "SUV", "PREMIUM", "MINIBUS"];

/** Places proposées par défaut : l'utilisateur n'a qu'à corriger si besoin. */
const DEFAULT_SEATS: Record<VehicleType, string> = {
  ECONOMIQUE: "4",
  CONFORT: "4",
  SUV: "6",
  PREMIUM: "4",
  MINIBUS: "14",
};

export default function DriverVehiclesScreen() {
  const { colors, space, text } = useTheme();
  const { t, formatAmount } = useI18n();

  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<VehicleType>("ECONOMIQUE");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [seats, setSeats] = useState(DEFAULT_SEATS.ECONOMIQUE);
  const [price, setPrice] = useState("");

  const load = useCallback(() => {
    api
      .driverMe()
      .then(setProfile)
      .catch(() => setError(t("common.networkError")));
  }, [t]);

  useFocusEffect(useCallback(() => load(), [load]));

  if (!profile) {
    return (
      <Screen>{error ? <Notice message={error} tone="error" /> : <Loading />}</Screen>
    );
  }

  // Le prix à la journée n'a de sens que pour la location en ville : un
  // chauffeur qui ne fait que du frontalier n'a pas à en saisir un.
  const needsPrice = profile.offersLocationVille;
  const seatCount = Number(seats);
  const priceValue = Number(price);

  const valid =
    plate.trim().length >= 3 &&
    Number.isInteger(seatCount) &&
    seatCount >= 1 &&
    seatCount <= 50 &&
    (!needsPrice || (Number.isInteger(priceValue) && priceValue > 0));

  function chooseType(next: VehicleType) {
    setType(next);
    setSeats(DEFAULT_SEATS[next]);
  }

  async function handleAdd() {
    setSaving(true);
    setError(null);
    try {
      await api.driverAddVehicle({
        type,
        plateNumber: plate.trim().toUpperCase(),
        seats: seatCount,
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
        pricePerDay: needsPrice ? priceValue : undefined,
      });
      setAdding(false);
      setBrand("");
      setModel("");
      setPlate("");
      setPrice("");
      load();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 0
          ? t("common.networkError")
          : t("common.genericError")
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmRemove(id: string) {
    Alert.alert(t("driver.removeVehicle"), t("driver.removeVehicleBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("driver.removeVehicle"),
        style: "destructive",
        onPress: async () => {
          try {
            await api.driverRemoveVehicle(id);
            load();
          } catch (err) {
            setError(
              err instanceof ApiError && err.status === 409
                ? t("driver.vehicleInUse")
                : t("common.genericError")
            );
          }
        },
      },
    ]);
  }

  return (
    <Screen scroll>
      {error ? <Notice message={error} tone="error" /> : null}

      {profile.vehicles.length === 0 && !adding ? (
        <EmptyState
          title={t("driver.noVehicles")}
          hint={needsPrice ? t("driver.noVehiclesHint") : undefined}
        />
      ) : null}

      {profile.vehicles.map((vehicle) => (
        <Card key={vehicle.id}>
          <Text style={[text.subheading, { color: colors.text }]}>
            {[vehicle.brand, vehicle.model].filter(Boolean).join(" ") ||
              t(`vehicleType.${vehicle.type}`)}
          </Text>
          <Text style={[text.caption, { color: colors.textMuted }]}>
            {t(`vehicleType.${vehicle.type}`)} · {vehicle.plateNumber} ·{" "}
            {vehicle.seats} {t("common.seats")}
          </Text>
          {vehicle.pricePerDay ? (
            <Text style={[text.label, { color: colors.text }]}>
              {formatAmount(vehicle.pricePerDay)} / {t("common.day")}
            </Text>
          ) : null}
          <Button
            label={t("driver.removeVehicle")}
            variant="danger"
            onPress={() => confirmRemove(vehicle.id)}
          />
        </Card>
      ))}

      {adding ? (
        <Card>
          <Text style={[text.label, { color: colors.textMuted }]}>
            {t("driver.addVehicle")}
          </Text>

          <ChoiceGroup
            label={t("driver.vehicleKind")}
            options={TYPES.map((value) => ({
              value,
              label: t(`vehicleType.${value}`),
            }))}
            value={type}
            onChange={chooseType}
          />

          <TextField
            label={t("driver.plate")}
            value={plate}
            onChangeText={setPlate}
            autoCapitalize="characters"
            placeholder="AB-1234-RB"
          />
          <TextField label={t("driver.brand")} value={brand} onChangeText={setBrand} />
          <TextField label={t("driver.model")} value={model} onChangeText={setModel} />
          <TextField
            label={t("driver.seatsCount")}
            value={seats}
            onChangeText={setSeats}
            keyboardType="number-pad"
          />
          {needsPrice ? (
            <TextField
              label={t("driver.pricePerDay")}
              value={price}
              onChangeText={setPrice}
              keyboardType="number-pad"
              placeholder="50000"
            />
          ) : null}

          <View style={{ gap: space[2] }}>
            <Button
              label={t("common.save")}
              onPress={handleAdd}
              loading={saving}
              disabled={!valid}
            />
            <Button
              label={t("common.cancel")}
              variant="ghost"
              onPress={() => setAdding(false)}
              disabled={saving}
            />
          </View>
        </Card>
      ) : (
        <Button label={t("driver.addVehicle")} onPress={() => setAdding(true)} />
      )}
    </Screen>
  );
}
