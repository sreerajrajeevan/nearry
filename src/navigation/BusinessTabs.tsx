import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useUnreadCounts } from "../hooks/useUnreadCounts";
import { BusinessTabParamList, BusinessStackParamList } from "./types";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../store/AuthContext";
import { tabOptions, useTabBarLayout } from "./tabOptions";
import { DashboardScreen } from "../screens/business/DashboardScreen";
import { CreateOfferScreen } from "../screens/business/CreateOfferScreen";
import { BookingsScreen } from "../screens/business/BookingsScreen";
import { MessagesScreen } from "../screens/business/MessagesScreen";
import { BusinessProfileScreen } from "../screens/business/BusinessProfileScreen";

const Tab = createBottomTabNavigator<BusinessTabParamList>();
export function BusinessTabs() {
  const tabBarLayout = useTabBarLayout();
  const { profile } = useAuth();
  const { messages } = useUnreadCounts();
  return (
    <Tab.Navigator screenOptions={tabBarLayout}>
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={tabOptions("grid", "Dashboard")}
      />
      <Tab.Screen
        name="CreateOffer"
        component={CreateOfferScreen}
        options={tabOptions("plus", "Create Offer")}
        listeners={({ navigation }) => ({
          tabPress: (event) => {
            if (profile && profile.verificationStatus !== "verified") {
              event.preventDefault();
              navigation
                .getParent<NativeStackNavigationProp<BusinessStackParamList>>()
                ?.navigate("BusinessVerification");
            }
          },
        })}
      />
      <Tab.Screen
        name="Bookings"
        component={BookingsScreen}
        options={tabOptions("calendar", "Bookings")}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          ...tabOptions("message-circle", "Messages"),
          tabBarBadge: messages > 0 ? messages : undefined,
        }}
      />
      <Tab.Screen
        name="Business"
        component={BusinessProfileScreen}
        options={tabOptions("briefcase", "Business")}
      />
    </Tab.Navigator>
  );
}
