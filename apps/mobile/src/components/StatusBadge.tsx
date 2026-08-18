import { Text, View } from "react-native";
import { useI18n } from "../i18n";
import { useTheme, type ThemeColors } from "../theme";
import type { BookingStatus } from "../api/types";

/** Couleur sémantique de chaque état — la teinte porte l'information. */
function toneFor(status: BookingStatus, colors: ThemeColors): string {
  switch (status) {
    case "COMPLETED":
      return colors.success;
    case "IN_PROGRESS":
    case "DRIVER_ASSIGNED":
      return colors.brand;
    case "AWAITING_PAYMENT":
      return colors.warning;
    case "CANCELLED":
    case "DISPUTED":
      return colors.danger;
    default:
      return colors.info;
  }
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  const { colors, radius, space, text } = useTheme();
  const { t } = useI18n();
  const tone = toneFor(status, colors);

  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: space[3],
        paddingVertical: space[1],
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: tone,
        backgroundColor: `${tone}1A`,
      }}
    >
      <Text style={[text.caption, { color: tone, fontWeight: "600" }]}>
        {t(`status.${status}`)}
      </Text>
    </View>
  );
}
