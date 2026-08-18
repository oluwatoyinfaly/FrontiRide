import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { HomeStackParamList } from "../navigation/types";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { InfoRow, Loading, Notice } from "../components/Feedback";
import { Screen } from "../components/Screen";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { ApiError, api } from "../api/client";
import type { Booking, PaymentMethod } from "../api/types";

type Props = NativeStackScreenProps<HomeStackParamList, "Payment">;

const METHODS: { value: PaymentMethod; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "MOMO_MTN", icon: "phone-portrait" },
  { value: "MOMO_MOOV", icon: "phone-portrait" },
  { value: "CARD", icon: "card" },
  { value: "CASH", icon: "cash" },
];

const LABEL_KEY: Record<PaymentMethod, string> = {
  MOMO_MTN: "payment.momoMtn",
  MOMO_MOOV: "payment.momoMoov",
  CARD: "payment.card",
  CASH: "payment.cash",
};

const ADVANCE_RATIO = 0.3;

export default function PaymentScreen({ route, navigation }: Props) {
  const { bookingId } = route.params;
  const { colors, radius, space, text } = useTheme();
  const { t, formatAmount } = useI18n();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("MOMO_MTN");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .booking(bookingId)
      .then(setBooking)
      .catch(() => setError(t("common.networkError")));
  }, [bookingId, t]);

  if (!booking) {
    return (
      <Screen>
        {error ? <Notice message={error} tone="error" /> : <Loading />}
      </Screen>
    );
  }

  const total = booking.estimatedPriceFcfa ?? 0;
  const isLocation = booking.type === "LOCATION_VILLE";
  const dueNow = isLocation ? Math.round(total * ADVANCE_RATIO) : total;

  async function handlePay() {
    setError(null);
    setSubmitting(true);
    try {
      const { paymentUrl } = await api.initiatePayment({ bookingId, method });

      // Espèces : rien à ouvrir, la course est confirmée côté serveur.
      if (paymentUrl) {
        await WebBrowser.openBrowserAsync(paymentUrl);
      }

      navigation.replace("TripDetail", { bookingId });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 0
          ? t("common.networkError")
          : t("payment.failed")
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll>
      <Card>
        <Text style={[text.label, { color: colors.textMuted }]}>
          {booking.reference}
        </Text>
        <Text style={[text.heading, { color: colors.text }]}>
          {booking.trancon
            ? `${booking.trancon.originCity} → ${booking.trancon.destinationCity}`
            : `${t(`vehicleType.${booking.vehicleType}`)} · ${booking.city}`}
        </Text>
        <View style={{ marginTop: space[2], gap: space[2] }}>
          <InfoRow label={t("booking.total")} value={formatAmount(total)} />
          {isLocation ? (
            <>
              <InfoRow label={t("payment.dueNow")} value={formatAmount(dueNow)} emphasis />
              <InfoRow
                label={t("payment.balanceLater")}
                value={formatAmount(total - dueNow)}
              />
            </>
          ) : null}
        </View>
      </Card>

      <Text style={[text.label, { color: colors.textMuted }]}>
        {t("payment.chooseMethod")}
      </Text>

      <View style={{ gap: space[2] }}>
        {METHODS.map((entry) => {
          const selected = entry.value === method;
          return (
            <Card key={entry.value} onPress={() => setMethod(entry.value)}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space[3],
                }}
              >
                <Ionicons
                  name={entry.icon}
                  size={20}
                  color={selected ? colors.brand : colors.textFaint}
                />
                <Text
                  style={[
                    text.subheading,
                    { color: colors.text, flex: 1 },
                  ]}
                >
                  {t(LABEL_KEY[entry.value])}
                </Text>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: radius.pill,
                    borderWidth: 2,
                    borderColor: selected ? colors.brand : colors.border,
                    backgroundColor: selected ? colors.brand : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selected ? (
                    <Ionicons name="checkmark" size={14} color={colors.onBrand} />
                  ) : null}
                </View>
              </View>
            </Card>
          );
        })}
      </View>

      <Text style={[text.caption, { color: colors.textMuted }]}>
        {method === "CASH" ? t("payment.cashNote") : t("payment.escrowNote")}
      </Text>

      {error ? <Notice message={error} tone="error" /> : null}

      <Button
        label={
          method === "CASH"
            ? t("payment.payCash")
            : t("payment.pay", { amount: formatAmount(dueNow) })
        }
        onPress={handlePay}
        loading={submitting}
      />
    </Screen>
  );
}
