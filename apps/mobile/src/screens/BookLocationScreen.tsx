import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { HomeStackParamList } from "../navigation/types";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ChoiceGroup, type Choice } from "../components/ChoiceGroup";
import { DateTimeField } from "../components/DateTimeField";
import { EmptyState, InfoRow, Loading, Notice } from "../components/Feedback";
import { Screen } from "../components/Screen";
import { Stepper } from "../components/Stepper";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { ApiError, api } from "../api/client";
import type { Vehicle, VehicleType } from "../api/types";

type Props = NativeStackScreenProps<HomeStackParamList, "BookLocation">;

const CITIES: Choice<string>[] = [
  { value: "Cotonou", label: "Cotonou" },
  { value: "Lomé", label: "Lomé" },
];

const VEHICLE_TYPES: VehicleType[] = [
  "ECONOMIQUE",
  "CONFORT",
  "SUV",
  "PREMIUM",
  "MINIBUS",
];

const ADVANCE_RATIO = 0.3;

function tomorrow(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(8, 0, 0, 0);
  return date;
}

export default function BookLocationScreen({ navigation }: Props) {
  const { colors, radius, space, text } = useTheme();
  const { t, formatAmount } = useI18n();

  const [city, setCity] = useState("Cotonou");
  const [type, setType] = useState<VehicleType | "">("");
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [startAt, setStartAt] = useState(tomorrow);
  const [durationDays, setDurationDays] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setVehicles(null);
    api
      .vehicles({ city, type: type || undefined })
      .then((list) => {
        if (cancelled) return;
        setVehicles(list);
        // La sélection précédente peut ne plus être dans la liste filtrée.
        setVehicleId((current) =>
          list.some((v) => v.id === current) ? current : (list[0]?.id ?? null)
        );
      })
      .catch(() => {
        if (!cancelled) setVehicles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [city, type]);

  const selected = vehicles?.find((v) => v.id === vehicleId) ?? null;
  const total = (selected?.pricePerDay ?? 0) * durationDays;
  const advance = Math.round(total * ADVANCE_RATIO);

  async function handleBook() {
    if (!selected) return;
    setError(null);
    setSubmitting(true);
    try {
      const { booking } = await api.bookLocation({
        vehicleId: selected.id,
        startAt: startAt.toISOString(),
        durationDays,
      });
      navigation.replace("Payment", { bookingId: booking.id });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(t("booking.vehicleBusy"));
      } else if (err instanceof ApiError && err.status === 400) {
        setError(t("booking.pastDate"));
      } else if (err instanceof ApiError && err.status === 0) {
        setError(t("common.networkError"));
      } else {
        setError(t("common.genericError"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll>
      <ChoiceGroup
        label={t("booking.city")}
        options={CITIES}
        value={city}
        onChange={setCity}
      />

      <ChoiceGroup
        label={t("booking.vehicleType")}
        options={[
          { value: "", label: "Tous" },
          ...VEHICLE_TYPES.map((v) => ({
            value: v,
            label: t(`vehicleType.${v}`),
          })),
        ]}
        value={type}
        onChange={(value) => setType(value as VehicleType | "")}
      />

      <Text style={[text.label, { color: colors.textMuted }]}>
        {t("booking.chooseVehicle")}
      </Text>

      {vehicles === null ? (
        <Loading />
      ) : vehicles.length === 0 ? (
        <EmptyState title={t("booking.noVehicles")} />
      ) : (
        <View style={{ gap: space[3] }}>
          {vehicles.map((vehicle) => {
            const isSelected = vehicle.id === vehicleId;
            return (
              <Pressable
                key={vehicle.id}
                onPress={() => setVehicleId(vehicle.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => ({
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? colors.brand : colors.border,
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  padding: isSelected ? space[4] - 1 : space[4],
                  opacity: pressed ? 0.85 : 1,
                  gap: space[1],
                })}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text style={[text.subheading, { color: colors.text }]}>
                    {vehicle.brand} {vehicle.model}
                  </Text>
                  <Text style={[text.label, { color: colors.brand }]}>
                    {t("booking.perDay", {
                      amount: formatAmount(vehicle.pricePerDay ?? 0),
                    })}
                  </Text>
                </View>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}
                >
                  <Text style={[text.caption, { color: colors.textMuted }]}>
                    {t(`vehicleType.${vehicle.type}`)} · {vehicle.seats}{" "}
                    {t("common.seats")}
                  </Text>
                  {vehicle.driver && vehicle.driver.ratingAverage > 0 ? (
                    <View
                      style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
                    >
                      <Ionicons name="star" size={12} color={colors.accent} />
                      <Text style={[text.caption, { color: colors.textMuted }]}>
                        {vehicle.driver.ratingAverage.toFixed(1)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <DateTimeField
        label={t("booking.startDate")}
        value={startAt}
        onChange={setStartAt}
        minimumDate={new Date()}
      />

      <Stepper
        label={t("booking.duration")}
        value={durationDays}
        min={1}
        max={30}
        onChange={setDurationDays}
      />

      {selected ? (
        <Card>
          <InfoRow
            label={`${formatAmount(selected.pricePerDay ?? 0)} × ${durationDays} ${
              durationDays > 1 ? t("common.days") : t("common.day")
            }`}
            value={formatAmount(total)}
          />
          <InfoRow label={t("payment.dueNow")} value={formatAmount(advance)} emphasis />
          <Text style={[text.caption, { color: colors.textMuted }]}>
            {t("booking.advanceNote")}
          </Text>
        </Card>
      ) : null}

      {error ? <Notice message={error} tone="error" /> : null}

      <Button
        label={t("booking.book")}
        onPress={handleBook}
        loading={submitting}
        disabled={!selected}
      />
    </Screen>
  );
}
