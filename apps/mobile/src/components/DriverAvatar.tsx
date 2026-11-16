import { useState } from "react";
import { Image, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_URL, authImageHeaders } from "../api/client";
import { useTheme } from "../theme";

/**
 * Visage du chauffeur, que le client cherche au rendez-vous. La photo n'est
 * pas publique : l'API la sert au seul client concerné, d'où l'en-tête
 * d'autorisation. Sans photo (ou si elle ne charge pas), on retombe sur la
 * silhouette plutôt que sur un trou.
 */
export function DriverAvatar({
  photoUrl,
  size = 64,
}: {
  photoUrl: string | null;
  size?: number;
}) {
  const { colors, radius } = useTheme();
  const [failed, setFailed] = useState(false);

  const box = {
    width: size,
    height: size,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    overflow: "hidden" as const,
  };

  if (!photoUrl || failed) {
    return (
      <View style={box}>
        <Ionicons name="person" size={size * 0.5} color={colors.textMuted} />
      </View>
    );
  }

  return (
    <View style={box}>
      <Image
        source={{ uri: `${API_URL}${photoUrl}`, headers: authImageHeaders() }}
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}
