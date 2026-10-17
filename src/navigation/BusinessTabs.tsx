import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useUnreadCounts } from "../hooks/useUnreadCounts";
import { BusinessTabParamList } from "./types";
import { tabOptions } from "./tabOptions";
import { DashboardScreen } from "../screens/business/DashboardScreen";
import { CreateOfferScreen } from "../screens/business/CreateOfferScreen";
import { BookingsScreen } from "../screens/business/BookingsScreen";
import { MessagesScreen } from "../screens/business/MessagesScreen";
import { BusinessProfileScreen } from "../screens/business/BusinessProfileScreen";

const Tab = createBottomTabNavigator<BusinessTabParamList>();
export function BusinessTabs() {
  const { messages } = useUnreadCounts();
  return (
    <Tab.Navigator>
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={tabOptions("grid", "Dashboard")}
      />
      <Tab.Screen
        name="CreateOffer"
        component={CreateOfferScreen}
        options={tabOptions("plus", "Create Offer")}
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
