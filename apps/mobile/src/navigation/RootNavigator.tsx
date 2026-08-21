import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import type {
  AuthStackParamList,
  DriverStackParamList,
  HomeStackParamList,
  ProfileStackParamList,
  TabParamList,
  TripsStackParamList,
} from "./types";
import { useSession } from "../auth/SessionProvider";
import { useI18n } from "../i18n";
import { navigationTheme, useTheme, type Theme } from "../theme";

import LoginScreen from "../screens/LoginScreen";
import OtpScreen from "../screens/OtpScreen";
import HomeScreen from "../screens/HomeScreen";
import BookFrontalierScreen from "../screens/BookFrontalierScreen";
import BookLocationScreen from "../screens/BookLocationScreen";
import PaymentScreen from "../screens/PaymentScreen";
import TripsScreen from "../screens/TripsScreen";
import TripDetailScreen from "../screens/TripDetailScreen";
import RateScreen from "../screens/RateScreen";
import ProfileScreen from "../screens/ProfileScreen";
import BecomeDriverScreen from "../screens/BecomeDriverScreen";
import DriverHomeScreen from "../screens/DriverHomeScreen";
import DriverDocumentsScreen from "../screens/DriverDocumentsScreen";
import DriverWalletScreen from "../screens/DriverWalletScreen";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const TripsStack = createNativeStackNavigator<TripsStackParamList>();
const DriverStack = createNativeStackNavigator<DriverStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

/** Options d'en-tête communes à toutes les piles, tirées des jetons. */
function headerOptions(theme: Theme) {
  return {
    headerStyle: { backgroundColor: theme.colors.surface },
    headerTitleStyle: {
      fontFamily: theme.text.subheading.fontFamily,
      fontSize: theme.text.subheading.fontSize,
      color: theme.colors.text,
    },
    headerTintColor: theme.colors.brand,
    headerShadowVisible: false,
    contentStyle: { backgroundColor: theme.colors.ground },
  };
}

function HomeNavigator() {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <HomeStack.Navigator screenOptions={headerOptions(theme)}>
      <HomeStack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <HomeStack.Screen
        name="BookFrontalier"
        component={BookFrontalierScreen}
        options={{ title: t("booking.frontalierTitle") }}
      />
      <HomeStack.Screen
        name="BookLocation"
        component={BookLocationScreen}
        options={{ title: t("booking.locationTitle") }}
      />
      <HomeStack.Screen
        name="Payment"
        component={PaymentScreen}
        options={{ title: t("payment.title") }}
      />
      <HomeStack.Screen
        name="TripDetail"
        component={TripDetailScreen}
        options={{ title: t("trips.title") }}
      />
      <HomeStack.Screen
        name="Rate"
        component={RateScreen}
        options={{ title: t("trips.rateTitle") }}
      />
    </HomeStack.Navigator>
  );
}

function TripsNavigator() {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <TripsStack.Navigator screenOptions={headerOptions(theme)}>
      <TripsStack.Screen
        name="Trips"
        component={TripsScreen}
        options={{ title: t("trips.title") }}
      />
      <TripsStack.Screen
        name="TripDetail"
        component={TripDetailScreen}
        options={{ title: t("trips.title") }}
      />
      <TripsStack.Screen
        name="Payment"
        component={PaymentScreen}
        options={{ title: t("payment.title") }}
      />
      <TripsStack.Screen
        name="Rate"
        component={RateScreen}
        options={{ title: t("trips.rateTitle") }}
      />
    </TripsStack.Navigator>
  );
}

function DriverNavigator() {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <DriverStack.Navigator screenOptions={headerOptions(theme)}>
      <DriverStack.Screen
        name="DriverHome"
        component={DriverHomeScreen}
        options={{ title: t("driver.title") }}
      />
      <DriverStack.Screen
        name="DriverDocuments"
        component={DriverDocumentsScreen}
        options={{ title: t("driver.documents") }}
      />
      <DriverStack.Screen
        name="DriverWallet"
        component={DriverWalletScreen}
        options={{ title: t("driver.wallet") }}
      />
    </DriverStack.Navigator>
  );
}

function ProfileNavigator() {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <ProfileStack.Navigator screenOptions={headerOptions(theme)}>
      <ProfileStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: t("profile.title") }}
      />
      <ProfileStack.Screen
        name="BecomeDriver"
        component={BecomeDriverScreen}
        options={{ title: t("driver.becomeTitle") }}
      />
    </ProfileStack.Navigator>
  );
}

/** Icône pleine à l'état actif, contour au repos — la convention du genre. */
const TAB_ICONS: Record<
  keyof TabParamList,
  [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]
> = {
  HomeTab: ["home", "home-outline"],
  TripsTab: ["receipt", "receipt-outline"],
  DriverTab: ["car-sport", "car-sport-outline"],
  ProfileTab: ["person-circle", "person-circle-outline"],
};

function AppTabs() {
  const { colors, radius, text, isDark } = useTheme();
  const { t } = useI18n();
  const { user } = useSession();

  // L'espace chauffeur n'a de sens que pour qui a déposé une candidature :
  // un client simple n'a pas à porter un onglet qui ne le concerne pas. Il
  // trouve l'entrée « devenir chauffeur » dans son profil.
  const isDriver = Boolean(user?.driverProfile);

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          height: 66,
          paddingTop: 8,
          paddingBottom: 10,
          // La barre se détache du contenu par son ombre plutôt que par un
          // filet, plus proche des apps de la catégorie.
          shadowColor: "#000",
          shadowOpacity: isDark ? 0.35 : 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -3 },
          elevation: 12,
        },
        tabBarLabelStyle: {
          fontFamily: text.label.fontFamily,
          fontSize: 11,
          marginTop: 2,
        },
        tabBarIcon: ({ color, focused }) => {
          const [filled, outline] = TAB_ICONS[route.name];
          return (
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 4,
                borderRadius: radius.pill,
                // Pastille de fond sous l'onglet actif : repère immédiat.
                backgroundColor: focused ? `${colors.brand}1A` : "transparent",
              }}
            >
              <Ionicons name={focused ? filled : outline} size={22} color={color} />
            </View>
          );
        },
      })}
    >
      <Tabs.Screen
        name="HomeTab"
        component={HomeNavigator}
        options={{ title: t("tabs.home") }}
      />
      <Tabs.Screen
        name="TripsTab"
        component={TripsNavigator}
        options={{ title: t("tabs.trips") }}
      />
      {isDriver ? (
        <Tabs.Screen
          name="DriverTab"
          component={DriverNavigator}
          options={{ title: t("tabs.driver") }}
        />
      ) : null}
      <Tabs.Screen
        name="ProfileTab"
        component={ProfileNavigator}
        options={{ title: t("tabs.profile") }}
      />
    </Tabs.Navigator>
  );
}

function AuthNavigator() {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <AuthStack.Navigator screenOptions={headerOptions(theme)}>
      <AuthStack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <AuthStack.Screen
        name="Otp"
        component={OtpScreen}
        options={{ title: t("auth.otpTitle") }}
      />
    </AuthStack.Navigator>
  );
}

export default function RootNavigator() {
  const theme = useTheme();
  const { user, restoring } = useSession();

  if (restoring) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.ground,
        }}
      >
        <ActivityIndicator color={theme.colors.brand} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme(theme)}>
      {user ? <AppTabs /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
