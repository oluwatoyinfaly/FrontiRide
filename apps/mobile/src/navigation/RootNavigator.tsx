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
        options={{ title: "FrontiRide" }}
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
    </ProfileStack.Navigator>
  );
}

const TAB_ICONS: Record<keyof TabParamList, keyof typeof Ionicons.glyphMap> = {
  HomeTab: "home",
  TripsTab: "receipt",
  DriverTab: "car-sport",
  ProfileTab: "person",
};

function AppTabs() {
  const { colors, text } = useTheme();
  const { t } = useI18n();

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontFamily: text.label.fontFamily, fontSize: 11 },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={TAB_ICONS[route.name]} size={size} color={color} />
        ),
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
      <Tabs.Screen
        name="DriverTab"
        component={DriverNavigator}
        options={{ title: t("tabs.driver") }}
      />
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
