import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { TripsStackParamList } from "../navigation/types";
import { Card } from "../components/Card";
import { EmptyState, Loading } from "../components/Feedback";
import { RoleBadge } from "../components/RoleBadge";
import { StatusBadge } from "../components/StatusBadge";
import { useSession } from "../auth/SessionProvider";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { api } from "../api/client";
import type { Booking, BookingRole } from "../api/types";

type Props = NativeStackScreenProps<TripsStackParamList, "Trips">;

const CLOSED_STATUSES = ["COMPLETED", "CANCELLED", "DISPUTED"];

type Filter = "ALL" | BookingRole;

export default function TripsScreen({ navigation }: Props) {
  const { colors, radius, space, text } = useTheme();
  const { t, formatAmount, formatDate } = useI18n();
  const { user } = useSession();

  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("ALL");

  // Un client simple n'a qu'un seul côté : lui montrer un filtre de rôle
  // n'aurait aucun sens.
  const isDriver = Boolean(user?.driverProfile);

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

  const visible =
    filter === "ALL" ? bookings : bookings.filter((b) => b.role === filter);

  const upcoming = visible.filter((b) => !CLOSED_STATUSES.includes(b.status));
  const past = visible.filter((b) => CLOSED_STATUSES.includes(b.status));

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
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}
              >
                <Text style={[text.caption, { color: colors.textFaint }]}>
                  {booking.reference}
                </Text>
                {isDriver ? <RoleBadge role={booking.role} /> : null}
              </View>
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
                {booking.role === "DRIVER" && booking.client?.fullName
                  ? ` · ${booking.client.fullName}`
                  : ""}
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
      {isDriver ? (
        <View style={{ flexDirection: "row", gap: space[2] }}>
          {(["ALL", "CLIENT", "DRIVER"] as const).map((value) => {
            const active = filter === value;
            return (
              <Text
                key={value}
                onPress={() => setFilter(value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  text.label,
                  {
                    paddingHorizontal: space[4],
                    paddingVertical: space[2],
                    borderRadius: radius.pill,
                    overflow: "hidden",
                    color: active ? colors.onBrand : colors.textMuted,
                    backgroundColor: active ? colors.brand : colors.surface,
                  },
                ]}
              >
                {t(
                  value === "ALL"
                    ? "trips.filterAll"
                    : value === "CLIENT"
                      ? "trips.filterClient"
                      : "trips.filterDriver"
                )}
              </Text>
            );
          })}
        </View>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          title={t(filter === "ALL" ? "trips.empty" : "trips.emptyFilter")}
          hint={filter === "ALL" ? t("trips.emptyHint") : undefined}
        />
      ) : (
        <>
          {renderSection(t("trips.upcoming"), upcoming)}
          {renderSection(t("trips.past"), past)}
        </>
      )}
    </ScrollView>
  );
}
