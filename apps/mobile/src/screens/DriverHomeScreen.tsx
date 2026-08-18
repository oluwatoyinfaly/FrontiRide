import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Switch, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { DriverStackParamList } from "../navigation/types";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ChoiceGroup } from "../components/ChoiceGroup";
import { EmptyState, InfoRow, Loading, Notice } from "../components/Feedback";
import { Screen } from "../components/Screen";
import { StatusBadge } from "../components/StatusBadge";
import { useSession } from "../auth/SessionProvider";
import { useI18n } from "../i18n";
import { useTheme, type ThemeColors } from "../theme";
import { ApiError, api } from "../api/client";
import type { DriverProfile, DriverRide, DriverStatus } from "../api/types";

type Props = NativeStackScreenProps<DriverStackParamList, "DriverHome">;

const STATUS_LABEL: Record<DriverStatus, string> = {
  PENDING_DOCUMENTS: "driver.statusPendingDocuments",
  PENDING_REVIEW: "driver.statusPendingReview",
  APPROVED: "driver.statusApproved",
  REJECTED: "driver.statusRejected",
  SUSPENDED: "driver.statusSuspended",
};

function statusTone(status: DriverStatus, colors: ThemeColors): string {
  if (status === "APPROVED") return colors.success;
  if (status === "REJECTED" || status === "SUSPENDED") return colors.danger;
  return colors.warning;
}

export default function DriverHomeScreen({ navigation }: Props) {
  const { colors, radius, space, text } = useTheme();
  const { t, formatAmount, formatDate } = useI18n();
  const { user, refresh } = useSession();

  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [available, setAvailable] = useState<DriverRide[]>([]);
  const [mine, setMine] = useState<DriverRide[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyRide, setBusyRide] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  const hasDriverProfile = Boolean(user?.driverProfile);

  const load = useCallback(async () => {
    if (!hasDriverProfile) {
      setLoaded(true);
      return;
    }
    try {
      const [me, rides, own] = await Promise.all([
        api.driverMe(),
        api.driverAvailableRides().catch(() => []),
        api.driverRides().catch(() => []),
      ]);
      setProfile(me);
      setAvailable(rides);
      setMine(own);
    } catch {
      setNotice({ message: t("common.networkError"), tone: "error" });
    } finally {
      setLoaded(true);
    }
  }, [hasDriverProfile, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!loaded) return <Loading label={t("common.loading")} />;
  if (!hasDriverProfile) return <DriverOnboarding onDone={refresh} />;
  if (!profile) return <Screen><EmptyState title={t("common.networkError")} /></Screen>;

  async function handleOnline(next: boolean) {
    try {
      await api.driverSetOnline(next);
      setProfile((p) => (p ? { ...p, isOnline: next } : p));
    } catch (err) {
      setNotice({
        message:
          err instanceof ApiError && err.status === 403
            ? t("driver.mustBeApproved")
            : t("common.genericError"),
        tone: "error",
      });
    }
  }

  async function runRideAction(
    rideId: string,
    action: () => Promise<unknown>,
    successMessage: string
  ) {
    setBusyRide(rideId);
    setNotice(null);
    try {
      await action();
      setNotice({ message: successMessage, tone: "success" });
      await load();
    } catch (err) {
      setNotice({
        message:
          err instanceof ApiError && err.status === 409
            ? t("driver.alreadyTaken")
            : t("common.genericError"),
        tone: "error",
      });
      await load();
    } finally {
      setBusyRide(null);
    }
  }

  const activeRides = mine.filter((r) =>
    ["DRIVER_ASSIGNED", "IN_PROGRESS"].includes(r.status)
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.ground }}
      contentContainerStyle={{ padding: space[6], gap: space[5], flexGrow: 1 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor={colors.brand}
        />
      }
    >
      <Card>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View
            style={{
              paddingHorizontal: space[3],
              paddingVertical: space[1],
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: statusTone(profile.status, colors),
              backgroundColor: `${statusTone(profile.status, colors)}1A`,
            }}
          >
            <Text
              style={[
                text.caption,
                { color: statusTone(profile.status, colors), fontWeight: "600" },
              ]}
            >
              {t(STATUS_LABEL[profile.status])}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            <Text style={[text.label, { color: colors.textMuted }]}>
              {profile.isOnline ? t("driver.online") : t("driver.offline")}
            </Text>
            <Switch
              value={profile.isOnline}
              onValueChange={handleOnline}
              trackColor={{ false: colors.border, true: colors.brand }}
            />
          </View>
        </View>

        {profile.missingDocuments.length > 0 ? (
          <Button
            label={t("driver.documentsMissing", {
              count: profile.missingDocuments.length,
            })}
            variant="secondary"
            onPress={() => navigation.navigate("DriverDocuments")}
          />
        ) : null}
      </Card>

      <Card onPress={() => navigation.navigate("DriverWallet")}>
        <Text style={[text.label, { color: colors.textMuted }]}>
          {t("driver.wallet")}
        </Text>
        <InfoRow
          label={t("driver.balance")}
          value={formatAmount(profile.wallet?.balanceFcfa ?? 0)}
          emphasis
        />
        <InfoRow
          label={t("driver.pending")}
          value={formatAmount(profile.wallet?.pendingFcfa ?? 0)}
        />
      </Card>

      {notice ? <Notice message={notice.message} tone={notice.tone} /> : null}

      {activeRides.length > 0 ? (
        <View style={{ gap: space[3] }}>
          <Text style={[text.label, { color: colors.textMuted }]}>
            {t("driver.myRides")}
          </Text>
          {activeRides.map((ride) => (
            <Card key={ride.id}>
              <RideSummary ride={ride} />
              <Button
                label={
                  ride.status === "DRIVER_ASSIGNED"
                    ? t("driver.start")
                    : t("driver.complete")
                }
                loading={busyRide === ride.id}
                onPress={() =>
                  ride.status === "DRIVER_ASSIGNED"
                    ? runRideAction(
                        ride.id,
                        () => api.driverStart(ride.id),
                        t("driver.accepted")
                      )
                    : runRideAction(
                        ride.id,
                        async () => {
                          const result = await api.driverComplete(ride.id);
                          setNotice({
                            message: t("driver.completed", {
                              amount: formatAmount(result.earningsFcfa),
                            }),
                            tone: "success",
                          });
                        },
                        t("driver.completed", { amount: "" })
                      )
                }
              />
            </Card>
          ))}
        </View>
      ) : null}

      <View style={{ gap: space[3] }}>
        <Text style={[text.label, { color: colors.textMuted }]}>
          {t("driver.availableRides")}
        </Text>

        {available.length === 0 ? (
          <EmptyState title={t("driver.noRides")} />
        ) : (
          available.map((ride) => (
            <Card key={ride.id}>
              <RideSummary ride={ride} />
              <Button
                label={t("driver.accept")}
                loading={busyRide === ride.id}
                onPress={() =>
                  runRideAction(
                    ride.id,
                    () => api.driverAccept(ride.id),
                    t("driver.accepted")
                  )
                }
              />
            </Card>
          ))
        )}
      </View>
    </ScrollView>
  );

  function RideSummary({ ride }: { ride: DriverRide }) {
    return (
      <>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={[text.caption, { color: colors.textFaint }]}>
            {ride.reference}
          </Text>
          <StatusBadge status={ride.status} />
        </View>
        <Text style={[text.subheading, { color: colors.text }]}>
          {ride.trancon
            ? `${ride.trancon.originCity} → ${ride.trancon.destinationCity}`
            : `${t(`vehicleType.${ride.vehicleType}`)} · ${ride.city}`}
        </Text>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={[text.caption, { color: colors.textMuted }]}>
            {formatDate(ride.departureAt ?? ride.startAt ?? ride.createdAt, true)}
          </Text>
          <Text style={[text.label, { color: colors.text }]}>
            {formatAmount(ride.estimatedPriceFcfa ?? 0)}
          </Text>
        </View>
      </>
    );
  }
}

/** Écran d'entrée pour un utilisateur qui n'a pas encore de dossier chauffeur. */
function DriverOnboarding({ onDone }: { onDone: () => Promise<void> }) {
  const { colors, space, text } = useTheme();
  const { t } = useI18n();

  const [baseCity, setBaseCity] = useState("Cotonou");
  const [frontalier, setFrontalier] = useState(true);
  const [location, setLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await api.driverRegister({
        baseCity,
        offersFrontalier: frontalier,
        offersLocationVille: location,
      });
      await onDone();
    } catch {
      setError(t("common.genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll>
      <Ionicons name="car-sport" size={40} color={colors.brand} />
      <Text style={[text.title, { color: colors.text }]}>
        {t("driver.becomeTitle")}
      </Text>
      <Text style={[text.body, { color: colors.textMuted }]}>
        {t("driver.becomeBody")}
      </Text>

      <ChoiceGroup
        label={t("driver.baseCity")}
        options={[
          { value: "Cotonou", label: "Cotonou" },
          { value: "Lomé", label: "Lomé" },
        ]}
        value={baseCity}
        onChange={setBaseCity}
      />

      <Text style={[text.label, { color: colors.textMuted }]}>
        {t("driver.offers")}
      </Text>

      <ToggleRow
        label={t("driver.offerFrontalier")}
        value={frontalier}
        onChange={setFrontalier}
      />
      <ToggleRow
        label={t("driver.offerLocation")}
        value={location}
        onChange={setLocation}
      />

      {error ? <Notice message={error} tone="error" /> : null}

      <Button
        label={t("driver.becomeCta")}
        onPress={handleSubmit}
        loading={submitting}
        disabled={!frontalier && !location}
      />
    </Screen>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const { colors, space, text } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: space[4],
      }}
    >
      <Text style={[text.body, { color: colors.text, flexShrink: 1 }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.brand }}
      />
    </View>
  );
}
