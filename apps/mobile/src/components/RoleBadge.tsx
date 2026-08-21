import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import type { BookingRole } from "../api/types";

/**
 * Un même compte peut réserver une course et en conduire une autre. Cette
 * pastille dit, pour une ligne donnée, de quel côté l'utilisateur se trouve :
 * l'icône porte l'information autant que le texte.
 */
export function RoleBadge({ role }: { role: BookingRole }) {
  const { colors, radius, space, text } = useTheme();
  const { t } = useI18n();

  const isDriver = role === "DRIVER";
  const tone = isDriver ? colors.brand : colors.info;

  return (
    <View
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: space[2],
        paddingVertical: 2,
        borderRadius: radius.pill,
        backgroundColor: `${tone}1A`,
      }}
    >
      <Ionicons
        name={isDriver ? "car-sport" : "person"}
        size={11}
        color={tone}
      />
      <Text style={[text.caption, { color: tone, fontWeight: "600" }]}>
        {t(isDriver ? "trips.asDriver" : "trips.asClient")}
      </Text>
    </View>
  );
}
