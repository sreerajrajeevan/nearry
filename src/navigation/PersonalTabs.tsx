import React, { useMemo } from "react";
import {
  createBottomTabNavigator,
  BottomTabScreenProps,
} from "@react-navigation/bottom-tabs";
import { useUnreadCounts } from "../hooks/useUnreadCounts";
import { PersonalMessagesContext } from "../store/PersonalMessagesContext";
import { PersonalTabParamList } from "./types";
import { lightTabOptions, useLightTabBarLayout } from "./tabOptions";
import { NearbyScreen } from "../screens/personal/NearbyScreen";
import { SearchScreen } from "../screens/personal/SearchScreen";
import { CreatePostScreen } from "../screens/personal/CreatePostScreen";
import { ActivityScreen } from "../screens/personal/ActivityScreen";
import { ProfileScreen } from "../screens/personal/ProfileScreen";
import { ChatListScreen } from "../screens/chat/ChatListScreen";

const Tab = createBottomTabNavigator<PersonalTabParamList>();

/**
 * The chat list shows a back button when its navigation can go back; as a
 * tab there is nowhere to go back to, so the tab hands it a navigation
 * that never offers one.
 */
function MessagesTabScreen(
  props: BottomTabScreenProps<PersonalTabParamList, "Messages">,
) {
  const navigation = useMemo(
    () => ({
      goBack: props.navigation.goBack,
      canGoBack: () => false,
      navigate: props.navigation.navigate as (
        screen: string,
        params?: Record<string, unknown>,
      ) => void,
    }),
    [props.navigation],
  );
  return <ChatListScreen navigation={navigation} />;
}

export function PersonalTabs() {
  const tabBarLayout = useLightTabBarLayout();
  const { messages } = useUnreadCounts();
  return (
    <PersonalMessagesContext.Provider value={messages}>
      <Tab.Navigator screenOptions={tabBarLayout}>
        <Tab.Screen
          name="Nearby"
          component={NearbyScreen}
          options={lightTabOptions("compass", "Discover")}
        />
        <Tab.Screen
          name="Activity"
          component={ActivityScreen}
          options={lightTabOptions("calendar", "My plans")}
        />
        <Tab.Screen
          name="CreatePost"
          component={CreatePostScreen}
          options={lightTabOptions("plus", "Create", true)}
        />
        <Tab.Screen
          name="Messages"
          component={MessagesTabScreen}
          options={{
            ...lightTabOptions("message-circle", "Chats"),
            tabBarBadge: messages > 0 ? messages : undefined,
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={lightTabOptions("user", "Profile")}
        />
        {/* Search stays a route (Home's search bar and other screens still
            navigate to it) but has no tab button: Nav 1 gives its slot to
            Chats, and the tab bar stays visible while searching. */}
        <Tab.Screen
          name="Search"
          component={SearchScreen}
          options={{
            ...lightTabOptions("search", "Search"),
            tabBarButton: () => null,
          }}
        />
      </Tab.Navigator>
    </PersonalMessagesContext.Provider>
  );
}
