import { useCallback, useState } from "react";
import { Alert, Linking, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { TripsStackParamList } from "../navigation/types";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { InfoRow, Loading, Notice } from "../components/Feedback";
import { Screen } from "../components/Screen";
import { StatusBadge } from "../components/StatusBadge";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { ApiError, api } from "../api/client";
import type { Booking } from "../api/types";

type Props = NativeStackScreenProps<TripsStackParamList, "TripDetail">;

const CANCELLABLE = ["AWAITING_PAYMENT", "CONFIRMED", "DRIVER_ASSIGNED"];

export default function TripDetailScreen({ route, navigation }: Props) {
  const { bookingId } = route.params;
  const { colors, radius, space, text } = useTheme();
  const { t, formatAmount, formatDate } = useI18n();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.booking(bookingId).then(setBooking).catch(() => setError(t("common.networkError")));
  }, [bookingId, t]);

  useFocusEffect(useCallback(() => load(), [load]));

  if (!booking) {
    return (
      <Screen>{error ? <Notice message={error} tone="error" /> : <Loading />}</Screen>
    );
  }

  const price = booking.finalPriceFcfa ?? booking.estimatedPriceFcfa ?? 0;
  const canCancel = CANCELLABLE.includes(booking.status);
  const canPay = booking.status === "AWAITING_PAYMENT";
  const canRate = booking.status === "COMPLETED" && !booking.rating && booking.driver;

  function confirmCancel() {
    Alert.alert(t("trips.cancelConfirm"), t("trips.cancelConfirmBody"), [
      { text: t("common.close"), style: "cancel" },
      {
        text: t("trips.cancelTrip"),
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          setError(null);
          try {
            setBooking(await api.cancelBooking(bookingId));
          } catch (err) {
            setError(
              err instanceof ApiError && err.status === 409
                ? t("trips.cannotCancel")
                : t("common.genericError")
            );
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <Screen scroll>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={[text.caption, { color: colors.textFaint }]}>
          {booking.reference}
        </Text>
        <StatusBadge status={booking.status} />
      </View>

      <Text style={[text.title, { color: colors.text }]}>
        {booking.trancon
          ? `${booking.trancon.originCity} → ${booking.trancon.destinationCity}`
          : `${t(`vehicleType.${booking.vehicleType}`)} · ${booking.city}`}
      </Text>

      <Card>
        {booking.trancon?.borderPoint ? (
          <InfoRow
            label={t("booking.route")}
            value={t("booking.borderCrossing", {
              point: booking.trancon.borderPoint,
            })}
          />
        ) : null}

        {booking.departureAt ? (
          <InfoRow
            label={t("booking.departure")}
            value={formatDate(booking.departureAt, true)}
          />
        ) : null}

        {booking.startAt ? (
          <InfoRow
            label={t("booking.startDate")}
            value={formatDate(booking.startAt)}
          />
        ) : null}

        {booking.durationDays ? (
          <InfoRow
            label={t("booking.duration")}
            value={`${booking.durationDays} ${
              booking.durationDays > 1 ? t("common.days") : t("common.day")
            }`}
          />
        ) : null}

        {booking.type === "FRONTALIER" ? (
          <InfoRow
            label={t("booking.passengers")}
            value={`${booking.seats} ${
              booking.seats > 1 ? t("common.seats") : t("common.seat")
            }`}
          />
        ) : null}

        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: space[3],
            marginTop: space[1],
          }}
        >
          <InfoRow label={t("booking.total")} value={formatAmount(price)} emphasis />
        </View>
      </Card>

      <Card>
        <Text style={[text.label, { color: colors.textMuted }]}>
          {t("trips.driver")}
        </Text>
        {booking.driver ? (
          <>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.pill,
                  backgroundColor: colors.surfaceMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="person" size={22} color={colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[text.subheading, { color: colors.text }]}>
                  {booking.driver.user.fullName}
                </Text>
                {booking.driver.ratingAverage > 0 ? (
                  <View
                    style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                  >
                    <Ionicons name="star" size={12} color={colors.accent} />
                    <Text style={[text.caption, { color: colors.textMuted }]}>
                      {booking.driver.ratingAverage.toFixed(1)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
            <Button
              label={t("trips.callDriver")}
              variant="secondary"
              onPress={() => Linking.openURL(`tel:${booking.driver!.user.phone}`)}
            />
          </>
        ) : (
          <Text style={[text.body, { color: colors.textMuted }]}>
            {t("trips.noDriverYet")}
          </Text>
        )}
      </Card>

      {booking.rating ? (
        <Card>
          <Text style={[text.label, { color: colors.textMuted }]}>
            {t("trips.rateTitle")}
          </Text>
          <View style={{ flexDirection: "row", gap: 2 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Ionicons
                key={n}
                name={n <= booking.rating!.score ? "star" : "star-outline"}
                size={18}
                color={colors.accent}
              />
            ))}
          </View>
          {booking.rating.comment ? (
            <Text style={[text.body, { color: colors.textMuted }]}>
              {booking.rating.comment}
            </Text>
          ) : null}
        </Card>
      ) : null}

      {error ? <Notice message={error} tone="error" /> : null}

      {canPay ? (
        <Button
          label={t("payment.title")}
          onPress={() => navigation.navigate("Payment", { bookingId })}
        />
      ) : null}

      {canRate ? (
        <Button
          label={t("trips.rate")}
          onPress={() =>
            navigation.navigate("Rate", {
              bookingId,
              driverName: booking.driver?.user.fullName ?? "",
            })
          }
        />
      ) : null}

      {canCancel ? (
        <Button
          label={t("trips.cancelTrip")}
          variant="secondary"
          onPress={confirmCancel}
          loading={busy}
        />
      ) : null}
    </Screen>
  );
}
