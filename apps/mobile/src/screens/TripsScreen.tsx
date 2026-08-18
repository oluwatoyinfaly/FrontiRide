import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { TripsStackParamList } from "../navigation/types";
import { Card } from "../components/Card";
import { EmptyState, Loading } from "../components/Feedback";
import { StatusBadge } from "../components/StatusBadge";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { api } from "../api/client";
import type { Booking } from "../api/types";

type Props = NativeStackScreenProps<TripsStackParamList, "Trips">;

const CLOSED_STATUSES = ["COMPLETED", "CANCELLED", "DISPUTED"];

export default function TripsScreen({ navigation }: Props) {
  const { colors, space, text } = useTheme();
  const { t, formatAmount, formatDate } = useI18n();

  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setBookings(await api.bookings());
    } catch {
      setBookings([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (bookings === null) {
    return <Loading label={t("common.loading")} />;
  }

  const upcoming = bookings.filter((b) => !CLOSED_STATUSES.includes(b.status));
  const past = bookings.filter((b) => CLOSED_STATUSES.includes(b.status));

  function renderSection(title: string, items: Booking[]) {
    if (items.length === 0) return null;
    return (
      <View style={{ gap: space[3] }}>
        <Text style={[text.label, { color: colors.textMuted }]}>{title}</Text>
        {items.map((booking) => (
          <Card
            key={booking.id}
            onPress={() =>
              navigation.navigate("TripDetail", { bookingId: booking.id })
            }
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: space[3],
              }}
            >
              <Text style={[text.caption, { color: colors.textFaint }]}>
                {booking.reference}
              </Text>
              <StatusBadge status={booking.status} />
            </View>

            <Text style={[text.subheading, { color: colors.text }]}>
              {booking.trancon
                ? `${booking.trancon.originCity} → ${booking.trancon.destinationCity}`
                : `${t(`vehicleType.${booking.vehicleType}`)} · ${booking.city}`}
            </Text>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={[text.caption, { color: colors.textMuted }]}>
                {formatDate(
                  booking.departureAt ?? booking.startAt ?? booking.createdAt,
                  Boolean(booking.departureAt)
                )}
              </Text>
              <Text style={[text.label, { color: colors.text }]}>
                {formatAmount(
                  booking.finalPriceFcfa ?? booking.estimatedPriceFcfa ?? 0
                )}
              </Text>
            </View>
          </Card>
        ))}
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.ground }}
      contentContainerStyle={{ padding: space[6], gap: space[6], flexGrow: 1 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.brand}
        />
      }
    >
      {bookings.length === 0 ? (
        <EmptyState title={t("trips.empty")} hint={t("trips.emptyHint")} />
      ) : (
        <>
          {renderSection(t("trips.upcoming"), upcoming)}
          {renderSection(t("trips.past"), past)}
        </>
      )}
    </ScrollView>
  );
}
