import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import {
  DefaultTheme,
  DarkTheme,
  type Theme as NavigationTheme,
} from "@react-navigation/native";
import {
  colorSchemes,
  radius,
  space,
  textStyles,
  type ThemeColors,
} from "./tokens";

export * from "./tokens";

export interface Theme {
  colors: ThemeColors;
  space: typeof space;
  radius: typeof radius;
  text: typeof textStyles;
  isDark: boolean;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const theme = useMemo<Theme>(
    () => ({
      colors: isDark ? colorSchemes.dark : colorSchemes.light,
      space,
      radius,
      text: textStyles,
      isDark,
    }),
    [isDark]
  );

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error("useTheme doit être utilisé à l'intérieur de <ThemeProvider>");
  }
  return theme;
}

/** Traduit les jetons FrontiRide vers le thème attendu par React Navigation. */
export function navigationTheme(theme: Theme): NavigationTheme {
  const base = theme.isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: theme.isDark,
    colors: {
      ...base.colors,
      primary: theme.colors.brand,
      background: theme.colors.ground,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.accent,
    },
  };
}
