import React from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";
import { Icon, IconName } from "../components/Icon";
import { MotionPressable } from "../components/Motion";
import { colors, typography } from "../theme";

/** Reserve room for both the labels and the device's gesture/navigation area. */
export function useTabBarLayout(): BottomTabNavigationOptions {
  const { bottom } = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const paddingBottom = Math.max(bottom, 8);
  return {
    tabBarStyle: [
      styles.bar,
      {
        height: 60 + Math.ceil(16 * Math.max(0, fontScale - 1)) + paddingBottom,
        paddingTop: 6,
        paddingBottom,
      },
    ],
  };
}

export function tabOptions(
  icon: IconName,
  title: string,
): BottomTabNavigationOptions {
  return {
    title,
    headerShown: false,
    tabBarHideOnKeyboard: true,
    tabBarActiveTintColor: colors.onAccent,
    tabBarInactiveTintColor: colors.gray300,
    tabBarActiveBackgroundColor: colors.accent,
    tabBarLabelPosition: "below-icon",
    tabBarItemStyle: styles.item,
    // Keep tab switches inside the app on web as well; an anchor reload loses drafts.
    tabBarButton: ({ style, disabled, href: _href, ...props }) => (
      <MotionPressable
        {...props}
        disabled={disabled ?? undefined}
        style={[style, styles.tabButton]}
      />
    ),
    tabBarLabelStyle: styles.label,
    tabBarIcon: ({ color }) => <Icon name={icon} size={21} color={color} />,
    tabBarBadgeStyle: {
      backgroundColor: colors.accent,
      color: colors.onAccent,
    },
  };
}
const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.ink,
    borderTopColor: colors.border,
    borderTopWidth: 0,
    borderRadius: 26,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 6,
    elevation: 0,
    shadowOpacity: 0,
  },
  item: { paddingVertical: 0, marginHorizontal: 2, borderRadius: 19 },
  tabButton: { borderRadius: 19 },
  label: {
    ...typography.caption,
    fontSize: 11,
    letterSpacing: 0,
    marginTop: 3,
  },
});
