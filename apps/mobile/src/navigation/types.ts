export type OtpCodes = { email: string; sms: string } | null;

export type AuthStackParamList = {
  Login: undefined;
  Otp: { userId: string; email: string; devCodes: OtpCodes };
};

export type HomeStackParamList = {
  Home: undefined;
  BookFrontalier: undefined;
  BookLocation: undefined;
  Payment: { bookingId: string };
  TripDetail: { bookingId: string };
  Rate: { bookingId: string; driverName: string };
};

export type TripsStackParamList = {
  Trips: undefined;
  TripDetail: { bookingId: string };
  Payment: { bookingId: string };
  Rate: { bookingId: string; driverName: string };
};

export type DriverStackParamList = {
  DriverHome: undefined;
  DriverDocuments: undefined;
  DriverWallet: undefined;
};

export type ProfileStackParamList = {
  Profile: undefined;
};

export type TabParamList = {
  HomeTab: undefined;
  TripsTab: undefined;
  DriverTab: undefined;
  ProfileTab: undefined;
};
