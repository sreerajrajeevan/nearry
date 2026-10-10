import { CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

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

/** Stack above the personal tabs: tab screens push details here. */
export type PersonalStackParamList = {
  PersonalTabs: undefined;
  PostDetails: { postId: string };
  VenueDetails: { venueId: string };
  EditPost: { postId: string };
  OfferDetails: { offerId: string };
};

/** Navigation available inside personal tab screens (tab + parent stack). */
export type PersonalTabNav = CompositeNavigationProp<
  BottomTabNavigationProp<PersonalTabParamList>,
  NativeStackNavigationProp<PersonalStackParamList>
>;

export type PostDetailsProps = NativeStackScreenProps<PersonalStackParamList, 'PostDetails'>;
export type VenueDetailsProps = NativeStackScreenProps<PersonalStackParamList, 'VenueDetails'>;

export type BusinessTabParamList = {
  Dashboard: undefined;
  CreateOffer: undefined;
  Bookings: undefined;
  Messages: undefined;
  Business: undefined;
};
