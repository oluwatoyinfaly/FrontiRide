import { useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";
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
import type { Trancon } from "../api/types";

type Props = NativeStackScreenProps<HomeStackParamList, "BookFrontalier">;

/** Départ par défaut : demain, pour éviter un refus « date passée ». */
function tomorrow(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(8, 0, 0, 0);
  return date;
}

export default function BookFrontalierScreen({ navigation }: Props) {
  const { colors, space, text } = useTheme();
  const { t, formatAmount } = useI18n();

  const [troncons, setTroncons] = useState<Trancon[] | null>(null);
  const [tranconId, setTranconId] = useState<string>("");
  const [departureAt, setDepartureAt] = useState(tomorrow);
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [seats, setSeats] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .troncons()
      .then((list) => {
        setTroncons(list);
        setTranconId(list[0]?.id ?? "");
      })
      .catch(() => setTroncons([]));
  }, []);

  if (troncons === null) {
    return (
      <Screen>
        <Loading label={t("common.loading")} />
      </Screen>
    );
  }

  if (troncons.length === 0) {
    return (
      <Screen>
        <EmptyState title={t("common.networkError")} />
      </Screen>
    );
  }

  const selected = troncons.find((tr) => tr.id === tranconId) ?? troncons[0];
  const legs = isRoundTrip ? 2 : 1;
  const base = selected.priceFcfa * legs;
  const customs = selected.estimatedCustomsFeeFcfa * legs;

  const options: Choice<string>[] = troncons.map((tr) => ({
    value: tr.id,
    label: `${tr.originCity} → ${tr.destinationCity}`,
  }));

  async function handleBook() {
    setError(null);
    setSubmitting(true);
    try {
      const { booking } = await api.bookFrontalier({
        tranconId: selected.id,
        departureAt: departureAt.toISOString(),
        isRoundTrip,
        seats,
      });
      navigation.replace("Payment", { bookingId: booking.id });
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
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
        label={t("booking.chooseRoute")}
        options={options}
        value={selected.id}
        onChange={setTranconId}
      />

      {selected.borderPoint ? (
        <Text style={[text.caption, { color: colors.textMuted }]}>
          {t("booking.borderCrossing", { point: selected.borderPoint })}
        </Text>
      ) : null}

      <DateTimeField
        label={t("booking.departure")}
        value={departureAt}
        onChange={setDepartureAt}
        withTime
        minimumDate={new Date()}
      />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: space[4],
        }}
      >
        <Text style={[text.label, { color: colors.textMuted }]}>
          {t("booking.roundTrip")}
        </Text>
        <Switch
          value={isRoundTrip}
          onValueChange={setIsRoundTrip}
          trackColor={{ false: colors.border, true: colors.brand }}
        />
      </View>

      <Stepper
        label={t("booking.passengers")}
        value={seats}
        min={1}
        max={4}
        onChange={setSeats}
      />
      <Text style={[text.caption, { color: colors.textFaint }]}>
        {t("booking.seatsHint")}
      </Text>

      <Card>
        <InfoRow label={t("booking.tripPrice")} value={formatAmount(base)} />
        <InfoRow label={t("booking.customsFee")} value={formatAmount(customs)} />
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: space[3],
            marginTop: space[1],
          }}
        >
          <InfoRow
            label={t("booking.priceEstimate")}
            value={formatAmount(base + customs)}
            emphasis
          />
        </View>
      </Card>

      {error ? <Notice message={error} tone="error" /> : null}

      <Button label={t("booking.book")} onPress={handleBook} loading={submitting} />
    </Screen>
  );
}
