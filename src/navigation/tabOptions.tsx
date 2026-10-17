import React from "react";
import { StyleSheet } from "react-native";
import { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";
import { Icon, IconName } from "../components/Icon";
import { colors, typography } from "../theme";

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
    tabBarStyle: styles.bar,
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
  // Keep React Navigation's automatic height and bottom inset for each device.
  bar: {
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 0,
    shadowOpacity: 0,
  },
  item: { paddingTop: 5, paddingBottom: 3 },
  label: {
    ...typography.caption,
    fontSize: 11,
    letterSpacing: 0,
    marginTop: 3,
  },
});
