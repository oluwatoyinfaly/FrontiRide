import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { HomeStackParamList } from "../navigation/types";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { StatusBadge } from "../components/StatusBadge";
import { useSession } from "../auth/SessionProvider";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { api } from "../api/client";
import type { Booking } from "../api/types";

type Props = NativeStackScreenProps<HomeStackParamList, "Home">;

/** États dans lesquels une course mérite d'être remontée en haut de l'accueil. */
const ACTIVE_STATUSES = ["CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS"];

export default function HomeScreen({ navigation }: Props) {
  const { colors, radius, space, text } = useTheme();
  const { t, formatDate } = useI18n();
  const { user } = useSession();
  const [active, setActive] = useState<Booking | null>(null);

  // Au retour sur l'onglet, la course en cours doit refléter l'état réel.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      api
        .bookings()
        .then((bookings) => {
          if (cancelled) return;
          setActive(bookings.find((b) => ACTIVE_STATUSES.includes(b.status)) ?? null);
        })
        .catch(() => {
          if (!cancelled) setActive(null);
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const firstName = user?.fullName?.split(" ")[0];

  return (
    <Screen scroll>
      <View style={{ gap: space[1] }}>
        <Text style={[text.caption, { color: colors.textMuted }]}>
          {firstName
            ? t("home.greeting", { name: firstName })
            : t("home.greetingAnonymous")}
        </Text>
        <Text style={[text.title, { color: colors.text }]}>
          {t("home.question")}
        </Text>
      </View>

      {active ? (
        <Card onPress={() => navigation.navigate("TripDetail", { bookingId: active.id })}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={[text.label, { color: colors.textMuted }]}>
              {t("home.activeTrip")}
            </Text>
            <StatusBadge status={active.status} />
          </View>
          <Text style={[text.heading, { color: colors.text }]}>
            {active.trancon
              ? `${active.trancon.originCity} → ${active.trancon.destinationCity}`
              : `${t(`vehicleType.${active.vehicleType}`)} · ${active.city}`}
          </Text>
          <Text style={[text.body, { color: colors.textMuted }]}>
            {active.reference} ·{" "}
            {formatDate(active.departureAt ?? active.startAt ?? active.createdAt, true)}
          </Text>
        </Card>
      ) : null}

      <ServiceCard
        icon="swap-horizontal"
        title={t("home.frontalier")}
        subtitle={t("home.frontalierSubtitle")}
        onPress={() => navigation.navigate("BookFrontalier")}
      />

      <ServiceCard
        icon="car-sport"
        title={t("home.location")}
        subtitle={t("home.locationSubtitle")}
        onPress={() => navigation.navigate("BookLocation")}
      />

      <View
        style={{
          flexDirection: "row",
          gap: space[3],
          backgroundColor: colors.surfaceMuted,
          borderRadius: radius.md,
          padding: space[4],
          marginTop: space[2],
        }}
      >
        <Ionicons name="shield-checkmark" size={22} color={colors.brand} />
        <View style={{ flex: 1, gap: space[1] }}>
          <Text style={[text.label, { color: colors.text }]}>
            {t("home.trustTitle")}
          </Text>
          <Text style={[text.caption, { color: colors.textMuted }]}>
            {t("home.trustBody")}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

function ServiceCard({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { colors, radius, space, text } = useTheme();

  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[4] }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.md,
            backgroundColor: colors.brand,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={24} color={colors.onBrand} />
        </View>
        <View style={{ flex: 1, gap: space[1] }}>
          <Text style={[text.heading, { color: colors.text }]}>{title}</Text>
          <Text style={[text.caption, { color: colors.textMuted }]}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
      </View>
    </Card>
  );
}
