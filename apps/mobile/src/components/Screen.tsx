import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { useTheme } from "../theme";

interface ScreenProps {
  children: ReactNode;
  /** Centre le contenu verticalement (formulaires courts). */
  centered?: boolean;
  scroll?: boolean;
  /**
   * Bords à protéger. Les écrans à en-tête n'ont besoin que du bas ;
   * ceux sans en-tête doivent aussi protéger le haut.
   */
  edges?: readonly Edge[];
}

export function Screen({
  children,
  centered = false,
  scroll = false,
  edges = ["bottom"],
}: ScreenProps) {
  const { colors, space } = useTheme();

  const content = { padding: space[6], gap: space[4] };

  return (
    <SafeAreaView
      edges={edges}
      style={{ flex: 1, backgroundColor: colors.ground }}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={[
            content,
            { flexGrow: 1, justifyContent: centered ? "center" : "flex-start" },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View
          style={[
            content,
            { flex: 1, justifyContent: centered ? "center" : "flex-start" },
          ]}
        >
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
