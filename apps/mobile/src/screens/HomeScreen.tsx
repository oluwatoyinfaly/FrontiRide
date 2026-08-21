import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { HomeStackParamList } from "../navigation/types";
import { RouteLine } from "../components/RouteLine";
import { StatusBadge } from "../components/StatusBadge";
import { useSession } from "../auth/SessionProvider";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { api } from "../api/client";
import type { Booking, Trancon } from "../api/types";

type Props = NativeStackScreenProps<HomeStackParamList, "Home">;

/** États dans lesquels une course mérite d'être remontée en haut de l'accueil. */
const ACTIVE_STATUSES = ["CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS"];

export default function HomeScreen({ navigation }: Props) {
  const { colors, radius, space, text, isDark } = useTheme();
  const { t, formatAmount, formatDate } = useI18n();
  const { user } = useSession();
  const insets = useSafeAreaInsets();

  const [active, setActive] = useState<Booking | null>(null);
  const [troncons, setTroncons] = useState<Trancon[]>([]);

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

      api
        .troncons()
        .then((list) => !cancelled && setTroncons(list.slice(0, 3)))
        .catch(() => {});

      return () => {
        cancelled = true;
      };
    }, [])
  );

  const firstName = user?.fullName?.split(" ")[0];
  const initial = (user?.fullName ?? user?.email ?? "?").charAt(0).toUpperCase();

  return (
    // Le bandeau fait partie du contenu défilant : posé en frère du ScrollView,
    // la carte de recherche qui le chevauche serait rognée par ce dernier.
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.ground }}
      contentContainerStyle={{ paddingBottom: space[10] }}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={{
          backgroundColor: colors.brandDeep,
          paddingTop: insets.top + space[4],
          paddingHorizontal: space[6],
          paddingBottom: space[12],
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text style={[text.caption, { color: "rgba(255,255,255,0.7)" }]}>
              {firstName
                ? t("home.greeting", { name: firstName })
                : t("home.greetingAnonymous")}
            </Text>
            <Text style={[text.title, { color: "#FFFFFF", marginTop: 2 }]}>
              FrontiRide
            </Text>
          </View>

          <Pressable
            onPress={() => navigation.getParent()?.navigate("ProfileTab")}
            accessibilityRole="button"
            accessibilityLabel={t("profile.title")}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.16)",
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={[text.subheading, { color: "#FFFFFF" }]}>{initial}</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ paddingHorizontal: space[6], gap: space[6] }}>
        {/* Entrée de destination : l'action principale, remontée sur le bandeau. */}
        <Pressable
          onPress={() => navigation.navigate("BookFrontalier")}
          accessibilityRole="button"
          style={({ pressed }) => ({
            marginTop: -space[8],
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            padding: space[5],
            flexDirection: "row",
            alignItems: "center",
            gap: space[4],
            opacity: pressed ? 0.9 : 1,
            // Ombre portée : c'est elle qui fait « flotter » la carte.
            shadowColor: "#000",
            shadowOpacity: isDark ? 0.4 : 0.12,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
            elevation: 6,
          })}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="location" size={20} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[text.subheading, { color: colors.text }]}>
              {t("home.searchCta")}
            </Text>
            <Text style={[text.caption, { color: colors.textMuted }]}>
              {t("home.searchHint")}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={colors.textFaint} />
        </Pressable>

        {active ? (
          <Pressable
            onPress={() => navigation.navigate("TripDetail", { bookingId: active.id })}
            accessibilityRole="button"
            style={({ pressed }) => ({
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.brand,
              overflow: "hidden",
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <View
              style={{
                backgroundColor: colors.brand,
                paddingVertical: space[2],
                paddingHorizontal: space[4],
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={[text.label, { color: colors.onBrand }]}>
                {t("home.activeTrip")}
              </Text>
              <Text style={[text.caption, { color: colors.onBrand }]}>
                {active.reference}
              </Text>
            </View>

            <View style={{ padding: space[4], gap: space[3] }}>
              {active.trancon ? (
                <RouteLine
                  origin={active.trancon.originCity}
                  destination={active.trancon.destinationCity}
                  borderPoint={active.trancon.borderPoint}
                />
              ) : (
                <Text style={[text.subheading, { color: colors.text }]}>
                  {t(`vehicleType.${active.vehicleType}`)} · {active.city}
                </Text>
              )}

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <StatusBadge status={active.status} />
                <Text style={[text.caption, { color: colors.textMuted }]}>
                  {formatDate(
                    active.departureAt ?? active.startAt ?? active.createdAt,
                    true
                  )}
                </Text>
              </View>
            </View>
          </Pressable>
        ) : null}

        <View style={{ gap: space[3] }}>
          <Text style={[text.label, { color: colors.textMuted }]}>
            {t("home.services")}
          </Text>

          <View style={{ flexDirection: "row", gap: space[3] }}>
            <ServiceTile
              icon="swap-horizontal"
              tint={colors.brand}
              title={t("home.frontalier")}
              subtitle={t("home.frontalierSubtitle")}
              onPress={() => navigation.navigate("BookFrontalier")}
            />
            <ServiceTile
              icon="car-sport"
              tint={colors.accent}
              title={t("home.location")}
              subtitle={t("home.locationSubtitle")}
              onPress={() => navigation.navigate("BookLocation")}
            />
          </View>
        </View>

        {troncons.length > 0 ? (
          <View style={{ gap: space[3] }}>
            <Text style={[text.label, { color: colors.textMuted }]}>
              {t("home.frequentRoutes")}
            </Text>

            {troncons.map((trancon) => (
              <Pressable
                key={trancon.id}
                onPress={() => navigation.navigate("BookFrontalier")}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: space[4],
                  gap: space[3],
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <RouteLine
                  origin={trancon.originCity}
                  destination={trancon.destinationCity}
                  borderPoint={trancon.borderPoint}
                  compact
                />
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={[text.caption, { color: colors.textMuted }]}>
                    {t("home.fromPrice", {
                      amount: formatAmount(
                        trancon.priceFcfa + trancon.estimatedCustomsFeeFcfa
                      ),
                    })}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View
          style={{
            flexDirection: "row",
            gap: space[3],
            backgroundColor: colors.surfaceMuted,
            borderRadius: radius.md,
            padding: space[4],
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
      </View>
    </ScrollView>
  );
}

function ServiceTile({
  icon,
  tint,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { colors, radius, space, text } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: space[4],
        gap: space[2],
        minHeight: 132,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.md,
          // Teinte de fond dérivée de l'accent : 1A en alpha ≈ 10 %.
          backgroundColor: `${tint}1A`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={21} color={tint} />
      </View>

      <Text style={[text.subheading, { color: colors.text }]}>{title}</Text>
      <Text style={[text.caption, { color: colors.textMuted }]}>{subtitle}</Text>
    </Pressable>
  );
}
