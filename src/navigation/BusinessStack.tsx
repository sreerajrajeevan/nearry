import {
  SafetyPrivacyScreen,
  BlockedUsersScreen,
  MyReportsScreen,
  ReportScreen,
  NotificationSettingsScreen,
  DeleteAccountScreen,
  LegalScreen,
} from "../screens/settings/SafetyScreens";
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { colors } from "../theme";
import { useReducedMotion } from "../store/MotionContext";
import { BusinessStackParamList } from "./types";
import { BusinessTabs } from "./BusinessTabs";
import { ConversationScreen } from "../screens/chat/ConversationScreen";
import { NotificationCenterScreen } from "../screens/NotificationCenterScreen";
import { MyOffersScreen } from "../screens/business/MyOffersScreen";
import { EditOfferScreen } from "../screens/business/EditOfferScreen";
import { EditBusinessProfileScreen } from "../screens/business/EditBusinessProfileScreen";
import { ManageVenueScreen } from "../screens/business/ManageVenueScreen";

const Stack = createNativeStackNavigator<BusinessStackParamList>();

/** Business experience: tab bar + pushable chat/notification screens above it. */
export function BusinessStack() {
  const reduced = useReducedMotion();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: reduced ? "none" : "slide_from_right",
        animationDuration: 240,
      }}
    >
      <Stack.Screen name="BusinessTabs" component={BusinessTabs} />
      <Stack.Screen name="Conversation" component={ConversationScreen} />
      <Stack.Screen name="Notifications" component={NotificationCenterScreen} />
      <Stack.Screen name="MyOffers" component={MyOffersScreen} />
      <Stack.Screen name="EditOffer" component={EditOfferScreen} />
      <Stack.Screen
        name="EditBusinessProfile"
        component={EditBusinessProfileScreen}
      />
      <Stack.Screen name="ManageVenue" component={ManageVenueScreen} />
      <Stack.Screen name="SafetyPrivacy" component={SafetyPrivacyScreen} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <Stack.Screen name="MyReports" component={MyReportsScreen} />
      <Stack.Screen name="Report" component={ReportScreen} />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
      />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
      <Stack.Screen name="Legal" component={LegalScreen} />
    </Stack.Navigator>
  );
}
