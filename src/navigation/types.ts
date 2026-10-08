export type AccountType = 'personal' | 'business';

export type RootStackParamList = {
  Welcome: undefined;
  PersonalAuth: { mode: 'login' | 'signup' } | undefined;
  BusinessAuth: { mode: 'login' | 'signup' } | undefined;
  PersonalOnboarding: undefined;
  BusinessOnboarding: undefined;
  PersonalApp: undefined;
  BusinessApp: undefined;
};

export type PersonalTabParamList = {
  Nearby: undefined;
  Search: undefined;
  CreatePost: undefined;
  Activity: undefined;
  Profile: undefined;
};

export type BusinessTabParamList = {
  Dashboard: undefined;
  CreateOffer: undefined;
  Bookings: undefined;
  Messages: undefined;
  Business: undefined;
};
