import type { DistanceOrigin } from "../utils/cardDistance";
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
  Introduction: { accountType: AccountType };
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
  Messages: undefined;
  /** `celebrate` carries the notification that opened the profile. */
  Profile: { celebrate?: string } | undefined;
};

/** Stack above the personal tabs: tab screens push details here. */
export type PersonalStackParamList = SafetyStackParamList & {
  PersonalTabs: NavigatorScreenParams<PersonalTabParamList> | undefined;
  PlaceDetails: { place: Place };
  /** confirmLeave: opened from "Not going", so ask whether to leave the plan. */
  PostDetails: { postId: string; confirmLeave?: boolean };
  /** Anyone's public profile: a host, or someone asking to join your plan. */
  HostProfile: { userId: string; name?: string; requestNote?: string };
  VenueDetails: { venueId: string };
  EditPost: { postId: string };
  MyPosts: undefined;
  SavedPlans: undefined;
  PlanGroup: { groupId?: string; postId?: string; messageId?: string };
  EditProfile: undefined;
  CompleteProfile: undefined;
  SelfieVerification: undefined;
  OfferDetails: { offerId: string };
  /** Every live offer in Home's area; distances are [venueId, km] pairs. */
  AllOffers:
    | {
        venueIds?: string[];
        distances?: [string, number][];
        distanceOrigin?: DistanceOrigin;
        area?: { latitude: number; longitude: number; radiusM: number };
      }
    | undefined;
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
  BusinessVerification: undefined;
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
