import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { HomeStackParamList } from "../navigation/types";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { InfoRow, Loading, Notice } from "../components/Feedback";
import { Screen } from "../components/Screen";
import { TextField } from "../components/TextField";
import { useSession } from "../auth/SessionProvider";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { ApiError, api } from "../api/client";
import type { Booking, PaymentMethod } from "../api/types";

type Props = NativeStackScreenProps<HomeStackParamList, "Payment">;

type MethodEntry = { value: PaymentMethod; icon: keyof typeof Ionicons.glyphMap };

const BENIN_METHODS: MethodEntry[] = [
  { value: "MOMO_MTN", icon: "phone-portrait" },
  { value: "MOMO_MOOV", icon: "phone-portrait" },
  { value: "MOMO_CELTIIS", icon: "phone-portrait" },
];

const TOGO_METHODS: MethodEntry[] = [
  { value: "MOMO_TOGOCOM", icon: "phone-portrait" },
  { value: "MOMO_MOOV_TG", icon: "phone-portrait" },
];

const CASH_METHOD: MethodEntry = { value: "CASH", icon: "cash" };

const LABEL_KEY: Record<PaymentMethod, string> = {
  MOMO_MTN: "payment.momoMtn",
  MOMO_MOOV: "payment.momoMoov",
  MOMO_CELTIIS: "payment.momoCeltiis",
  MOMO_MOOV_TG: "payment.momoMoovTg",
  MOMO_TOGOCOM: "payment.momoTogocom",
  CARD: "payment.card",
  CASH: "payment.cash",
};

const ADVANCE_RATIO = 0.3;

/** Rythme et durée du suivi pendant que le client valide sur son téléphone. */
const POLL_MS = 3000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

const isMobileMoney = (method: PaymentMethod) => method !== "CASH" && method !== "CARD";

/**
 * Les réseaux du pays du client passent en premier : un client togolais ne peut
 * pas payer avec MTN Bénin, il ne doit donc pas avoir à les chercher.
 */
function methodsFor(accountPhone: string | undefined): MethodEntry[] {
  const togolese = (accountPhone ?? "").replace(/\s/g, "").startsWith("+228");
  return togolese
    ? [...TOGO_METHODS, ...BENIN_METHODS, CASH_METHOD]
    : [...BENIN_METHODS, ...TOGO_METHODS, CASH_METHOD];
}

export default function PaymentScreen({ route, navigation }: Props) {
  const { bookingId } = route.params;
  const { colors, radius, space, text } = useTheme();
  const { t, formatAmount } = useI18n();
  const { user } = useSession();

  const [booking, setBooking] = useState<Booking | null>(null);
  const methods = methodsFor(user?.phone);
  const [method, setMethod] = useState<PaymentMethod>(methods[0].value);
  // Le numéro du compte par défaut ; on paie souvent avec une autre SIM.
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Identifiant du paiement dont on attend la validation sur le téléphone.
  const [waitingFor, setWaitingFor] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const stopped = useRef(false);

  // Suivi du paiement : on demande au serveur, qui demande à FeexPay, jusqu'à
  // l'issue. L'arrêt est contrôlé pour qu'un écran quitté ne continue pas à
  // interroger dans le vide.
  useEffect(() => {
    if (!waitingFor) return;
    stopped.current = false;
    const startedAt = Date.now();

    const timer = setInterval(async () => {
      if (stopped.current) return;
      try {
        const { status } = await api.paymentStatus(waitingFor);
        if (stopped.current) return;

        if (status === "ESCROW_HELD") {
          stopped.current = true;
          navigation.replace("TripDetail", { bookingId });
        } else if (status === "FAILED") {
          stopped.current = true;
          setWaitingFor(null);
          setError(t("payment.declined"));
        } else if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          stopped.current = true;
          setTimedOut(true);
        }
      } catch {
        // Réseau instable : on retente au tour suivant, sans rien annoncer.
      }
    }, POLL_MS);

    return () => {
      stopped.current = true;
      clearInterval(timer);
    };
  }, [waitingFor, bookingId, navigation, t]);

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

  const phoneValid = phone.replace(/\D/g, "").length >= 8;

  async function handlePay() {
    setError(null);
    setTimedOut(false);
    setSubmitting(true);
    try {
      const result = await api.initiatePayment({
        bookingId,
        method,
        phone: isMobileMoney(method) ? phone.trim() : undefined,
      });

      // Espèces : réglé tout de suite, la course est confirmée côté serveur.
      if (result.status === "CONFIRMED") {
        navigation.replace("TripDetail", { bookingId });
        return;
      }

      // Mobile Money : une demande vient de partir sur le téléphone.
      setWaitingFor(result.payment.id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.details?.paymentId) {
        // Une demande attend déjà la validation : on la reprend plutôt que d'en
        // envoyer une seconde.
        setWaitingFor(String(err.details.paymentId));
      } else if (err instanceof ApiError && err.status === 0) {
        setError(t("common.networkError"));
      } else if (err instanceof ApiError && err.status === 400) {
        // Refus du prestataire (numéro invalide…) : son motif aide l'utilisateur.
        setError(err.message || t("payment.failed"));
      } else if (err instanceof ApiError && err.status === 503) {
        setError(t("payment.unavailable"));
      } else {
        setError(t("payment.failed"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (waitingFor) {
    return (
      <Screen>
        <Card>
          <View style={{ alignItems: "center", gap: space[4], paddingVertical: space[4] }}>
            {timedOut ? (
              <Ionicons name="time" size={40} color={colors.warning} />
            ) : (
              <ActivityIndicator size="large" color={colors.brand} />
            )}
            <Text style={[text.heading, { color: colors.text, textAlign: "center" }]}>
              {timedOut ? t("payment.timeoutTitle") : t("payment.waitingTitle")}
            </Text>
            <Text style={[text.body, { color: colors.textMuted, textAlign: "center" }]}>
              {timedOut
                ? t("payment.timeoutBody")
                : t("payment.waitingBody", { amount: formatAmount(dueNow) })}
            </Text>
          </View>
        </Card>

        {timedOut ? (
          <Button
            label={t("payment.viewTrip")}
            onPress={() => navigation.replace("TripDetail", { bookingId })}
          />
        ) : null}
      </Screen>
    );
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
        {methods.map((entry) => {
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

      {isMobileMoney(method) ? (
        <TextField
          label={t("payment.phoneLabel")}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder="+229 97 00 00 00"
        />
      ) : null}

      <Text style={[text.caption, { color: colors.textMuted }]}>
        {method === "CASH"
          ? t("payment.cashNote")
          : `${t("payment.phoneHint")} ${t("payment.escrowNote")}`}
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
        disabled={isMobileMoney(method) && !phoneValid}
      />
    </Screen>
  );
}
