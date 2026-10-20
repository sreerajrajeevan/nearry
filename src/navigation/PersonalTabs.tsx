import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useUnreadCounts } from "../hooks/useUnreadCounts";
import { PersonalMessagesContext } from "../store/PersonalMessagesContext";
import { PersonalTabParamList } from "./types";
import { tabOptions, useTabBarLayout } from "./tabOptions";
import { NearbyScreen } from "../screens/personal/NearbyScreen";
import { SearchScreen } from "../screens/personal/SearchScreen";
import { CreatePostScreen } from "../screens/personal/CreatePostScreen";
import { ActivityScreen } from "../screens/personal/ActivityScreen";
import { ProfileScreen } from "../screens/personal/ProfileScreen";

const Tab = createBottomTabNavigator<PersonalTabParamList>();
export function PersonalTabs() {
  const tabBarLayout = useTabBarLayout();
  const { messages } = useUnreadCounts();
  return (
    <PersonalMessagesContext.Provider value={messages}>
      <Tab.Navigator screenOptions={tabBarLayout}>
        <Tab.Screen
          name="Nearby"
          component={NearbyScreen}
          options={tabOptions("home", "Nearby")}
        />
        <Tab.Screen
          name="Search"
          component={SearchScreen}
          options={tabOptions("search", "Search")}
        />
        <Tab.Screen
          name="CreatePost"
          component={CreatePostScreen}
          options={tabOptions("plus", "Create")}
        />
        <Tab.Screen
          name="Activity"
          component={ActivityScreen}
          options={tabOptions("calendar", "Activity")}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={tabOptions("user", "Profile")}
        />
      </Tab.Navigator>
    </PersonalMessagesContext.Provider>
  );
}
