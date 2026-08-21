import { Text, View } from "react-native";
import { useTheme } from "../theme";

interface RouteLineProps {
  origin: string;
  destination: string;
  /** Poste-frontière traversé, marqué d'un losange au milieu du tracé. */
  borderPoint?: string | null;
  compact?: boolean;
}

/**
 * Tracé d'un trajet frontalier. Le passage de frontière est ce qui distingue
 * FrontiRide d'une app de VTC ordinaire : il mérite d'être montré, pas écrit.
 */
export function RouteLine({
  origin,
  destination,
  borderPoint,
  compact = false,
}: RouteLineProps) {
  const { colors, space, text } = useTheme();

  const dot = (filled: boolean) => ({
    width: compact ? 8 : 10,
    height: compact ? 8 : 10,
    borderRadius: 999,
    backgroundColor: filled ? colors.brand : colors.surface,
    borderWidth: 2,
    borderColor: colors.brand,
  });

  const segment = {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
  };

  return (
    <View style={{ gap: space[1] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] }}>
        <View style={dot(true)} />
        <View style={segment} />
        {borderPoint ? (
          <View
            style={{
              width: compact ? 8 : 10,
              height: compact ? 8 : 10,
              backgroundColor: colors.accent,
              transform: [{ rotate: "45deg" }],
            }}
          />
        ) : null}
        <View style={segment} />
        <View style={dot(false)} />
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={[text.caption, { color: colors.text, fontWeight: "600" }]}>
          {origin}
        </Text>
        {borderPoint && !compact ? (
          <Text style={[text.caption, { color: colors.accent }]}>{borderPoint}</Text>
        ) : null}
        <Text style={[text.caption, { color: colors.text, fontWeight: "600" }]}>
          {destination}
        </Text>
      </View>
    </View>
  );
}
