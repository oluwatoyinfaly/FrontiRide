import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useTheme } from "../theme";

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
}

export function Card({ children, onPress }: CardProps) {
  const { colors, radius, space } = useTheme();

  const surface = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space[5],
    gap: space[2],
  };

  if (!onPress) {
    return <View style={surface}>{children}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [surface, pressed && { opacity: 0.85 }]}
    >
      {children}
    </Pressable>
  );
}
