import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { InfoRow, Loading, Notice } from "../components/Feedback";
import { Screen } from "../components/Screen";
import { TextField } from "../components/TextField";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { ApiError, api } from "../api/client";
import type { DriverProfile } from "../api/types";

const MIN_WITHDRAWAL = 5000;

export default function DriverWalletScreen() {
  const { colors, space, text } = useTheme();
  const { t, formatAmount, formatDate } = useI18n();

  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  const load = useCallback(() => {
    api.driverMe().then(setProfile).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => load(), [load]));

  if (!profile) return <Loading />;

  const wallet = profile.wallet;
  const parsed = Number(amount.replace(/\s/g, ""));
  const canSubmit =
    Number.isFinite(parsed) &&
    parsed >= MIN_WITHDRAWAL &&
    parsed <= (wallet?.balanceFcfa ?? 0) &&
    destination.trim().length >= 6;

  async function handleWithdraw() {
    setSubmitting(true);
    setNotice(null);
    try {
      await api.driverWithdraw(parsed, destination.trim());
      setAmount("");
      setDestination("");
      setNotice({ message: t("driver.withdrawRequested"), tone: "success" });
      load();
    } catch (err) {
      setNotice({
        message:
          err instanceof ApiError && err.status === 400
            ? t("driver.insufficientBalance")
            : t("common.genericError"),
        tone: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll>
      <Card>
        <InfoRow
          label={t("driver.balance")}
          value={formatAmount(wallet?.balanceFcfa ?? 0)}
          emphasis
        />
        <InfoRow
          label={t("driver.pending")}
          value={formatAmount(wallet?.pendingFcfa ?? 0)}
        />
        <Text style={[text.caption, { color: colors.textFaint }]}>
          {t("driver.commission", {
            rate: Math.round((wallet?.commissionRate ?? 0) * 100),
          })}
        </Text>
      </Card>

      <Card>
        <Text style={[text.label, { color: colors.textMuted }]}>
          {t("driver.withdraw")}
        </Text>
        <TextField
          label={t("driver.withdrawAmount")}
          value={amount}
          onChangeText={setAmount}
          keyboardType="number-pad"
          placeholder={String(MIN_WITHDRAWAL)}
        />
        <TextField
          label={t("driver.withdrawDestination")}
          value={destination}
          onChangeText={setDestination}
          keyboardType="phone-pad"
          placeholder="+229 …"
        />
        <Text style={[text.caption, { color: colors.textFaint }]}>
          {t("driver.withdrawMin", { amount: formatAmount(MIN_WITHDRAWAL) })}
        </Text>
        <Button
          label={t("driver.withdraw")}
          onPress={handleWithdraw}
          loading={submitting}
          disabled={!canSubmit}
        />
      </Card>

      {notice ? <Notice message={notice.message} tone={notice.tone} /> : null}

      {wallet && wallet.withdrawals.length > 0 ? (
        <View style={{ gap: space[3] }}>
          <Text style={[text.label, { color: colors.textMuted }]}>
            {t("driver.wallet")}
          </Text>
          {wallet.withdrawals.map((w) => (
            <Card key={w.id}>
              <InfoRow
                label={formatDate(w.createdAt)}
                value={formatAmount(w.amountFcfa)}
              />
              <Text style={[text.caption, { color: colors.textMuted }]}>
                {w.status}
              </Text>
            </Card>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
