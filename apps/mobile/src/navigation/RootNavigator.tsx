import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { navigationTheme, useTheme } from "../theme";
import LoginScreen from "../screens/LoginScreen";
import OtpScreen from "../screens/OtpScreen";
import HomeScreen from "../screens/HomeScreen";
import BookFrontalierScreen from "../screens/BookFrontalierScreen";
import BookLocationVilleScreen from "../screens/BookLocationVilleScreen";

export type RootStackParamList = {
  Login: undefined;
  Otp: { userId: string; email: string };
  Home: undefined;
  BookFrontalier: undefined;
  BookLocationVille: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const theme = useTheme();
  const { colors, text } = theme;

  return (
    <NavigationContainer theme={navigationTheme(theme)}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: {
            fontFamily: text.subheading.fontFamily,
            fontSize: text.subheading.fontSize,
            color: colors.text,
          },
          headerTintColor: colors.brand,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.ground },
        }}
      >
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Otp"
          component={OtpScreen}
          options={{ title: "Vérification" }}
        />
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: "FrontiRide", headerBackVisible: false }}
        />
        <Stack.Screen
          name="BookFrontalier"
          component={BookFrontalierScreen}
          options={{ title: "Transport Frontalier" }}
        />
        <Stack.Screen
          name="BookLocationVille"
          component={BookLocationVilleScreen}
          options={{ title: "Location avec Chauffeur" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
