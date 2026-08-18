import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import RootNavigator from "./src/navigation/RootNavigator";
import { SessionProvider } from "./src/auth/SessionProvider";
import { I18nProvider } from "./src/i18n";
import { ThemeProvider, useTheme } from "./src/theme";
import { useAppFonts } from "./src/theme/useAppFonts";

function Root() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <RootNavigator />
    </>
  );
}

export default function App() {
  const fontsReady = useAppFonts();

  if (!fontsReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <ThemeProvider>
          <SessionProvider>
            <Root />
          </SessionProvider>
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
