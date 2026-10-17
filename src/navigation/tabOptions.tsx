import React from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";
import { Icon, IconName } from "../components/Icon";
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
    tabBarActiveTintColor: colors.accent,
    tabBarInactiveTintColor: colors.textDim,
    tabBarLabelPosition: "below-icon",
    tabBarItemStyle: styles.item,
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
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 0,
    shadowOpacity: 0,
  },
  item: { paddingVertical: 0 },
  label: {
    ...typography.caption,
    fontSize: 11,
    letterSpacing: 0,
    marginTop: 3,
  },
});
