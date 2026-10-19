import type { Place } from "../services/places";
import {
  CompositeNavigationProp,
  NavigatorScreenParams,
} from "@react-navigation/native";
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";

export type AccountType = "personal" | "business";

export type SafetyStackParamList = {
  SafetyPrivacy: undefined;
  BlockedUsers: undefined;
  MyReports: undefined;
  Report: { target: import("../services/safety").ReportTarget };
  NotificationSettings: undefined;
  DeleteAccount: undefined;
  Legal: { page?: import("../utils/legal").LegalPage } | undefined;
};

export type RootStackParamList = {
  Legal: { page?: import("../utils/legal").LegalPage } | undefined;
  Welcome: undefined;
  PersonalAuth: { mode: "login" | "signup" } | undefined;
  BusinessAuth: { mode: "login" | "signup" } | undefined;
  PersonalOnboarding: undefined;
  BusinessOnboarding: undefined;
  PersonalApp: undefined;
  BusinessApp: undefined;
};

export type PersonalTabParamList = {
  Nearby: { place?: Place } | undefined;
  Search: undefined;
  CreatePost: undefined;
  Activity: undefined;
  Profile: undefined;
};

/** Stack above the personal tabs: tab screens push details here. */
export type PersonalStackParamList = SafetyStackParamList & {
  PersonalTabs: NavigatorScreenParams<PersonalTabParamList> | undefined;
  PlaceDetails: { place: Place };
  PostDetails: { postId: string };
  VenueDetails: { venueId: string };
  EditPost: { postId: string };
  MyPosts: undefined;
  EditProfile: undefined;
  OfferDetails: { offerId: string };
  Messages: undefined;
  Conversation: { conversationId: string; title?: string };
  Notifications: undefined;
};

export type BusinessStackParamList = SafetyStackParamList & {
  BusinessTabs: NavigatorScreenParams<BusinessTabParamList> | undefined;
  Conversation: { conversationId: string; title?: string };
  Notifications: undefined;
  MyOffers: undefined;
  EditOffer: { offerId: string };
  EditBusinessProfile: undefined;
  ManageVenue: undefined;
};

export type BusinessTabNav = CompositeNavigationProp<
  BottomTabNavigationProp<BusinessTabParamList>,
  NativeStackNavigationProp<BusinessStackParamList>
>;

/** Navigation available inside personal tab screens (tab + parent stack). */
export type PersonalTabNav = CompositeNavigationProp<
  BottomTabNavigationProp<PersonalTabParamList>,
  NativeStackNavigationProp<PersonalStackParamList>
>;

export type PostDetailsProps = NativeStackScreenProps<
  PersonalStackParamList,
  "PostDetails"
>;
export type VenueDetailsProps = NativeStackScreenProps<
  PersonalStackParamList,
  "VenueDetails"
>;

export type BusinessTabParamList = {
  Dashboard: undefined;
  CreateOffer: undefined;
  Bookings: undefined;
  Messages: undefined;
  Business: undefined;
};

export type EditPostProps = NativeStackScreenProps<
  PersonalStackParamList,
  "EditPost"
>;
