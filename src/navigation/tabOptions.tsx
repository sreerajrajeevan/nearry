import React from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
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
  prominent = false,
): BottomTabNavigationOptions {
  return {
    title,
    headerShown: false,
    tabBarHideOnKeyboard: true,
    tabBarActiveTintColor: colors.forest,
    tabBarInactiveTintColor: colors.textDim,
    tabBarActiveBackgroundColor: colors.sageSoft,
    tabBarLabelPosition: "below-icon",
    tabBarLabel: title === "Create Offer" ? "Create" : title,
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
    tabBarIcon: ({ color }) =>
      prominent ? (
        <View style={styles.create}>
          <Icon name={icon} size={24} color={colors.onAccent} />
        </View>
      ) : (
        <Icon name={icon} size={21} color={color} />
      ),
    tabBarBadgeStyle: {
      backgroundColor: colors.gold,
      color: colors.onGold,
    },
  };
}
const styles = StyleSheet.create({
  create: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.forest,
    alignItems: "center",
    justifyContent: "center",
  },
  bar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 0,
    marginBottom: 0,
    paddingHorizontal: 4,
    elevation: 0,
    shadowOpacity: 0,
  },
  item: { paddingVertical: 0, marginHorizontal: 2, borderRadius: 12 },
  tabButton: { borderRadius: 12 },
  label: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0,
    marginTop: 3,
  },
});
