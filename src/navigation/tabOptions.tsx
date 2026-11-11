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
  const { fontScale, width } = useWindowDimensions();
  const paddingBottom = Math.max(bottom, 8);
  return {
    tabBarLabelStyle: [styles.label, { fontSize: width < 350 ? 10 : 11 }],
    tabBarStyle: [
      styles.bar,
      {
        height: 64 + Math.ceil(16 * Math.max(0, fontScale - 1)) + paddingBottom,
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
    tabBarActiveTintColor: colors.white,
    tabBarInactiveTintColor: colors.onTeal,
    tabBarActiveBackgroundColor: colors.teal,
    tabBarLabelPosition: "below-icon",
    tabBarLabel:
      title === "Create Offer"
        ? "Create"
        : title === "Dashboard"
          ? "Home"
          : title,
    tabBarAccessibilityLabel: title,
    tabBarItemStyle: styles.item,
    // Keep tab switches inside the app on web as well; an anchor reload loses drafts.
    tabBarButton: ({ style, disabled, href: _href, ...props }) => (
      <MotionPressable
        {...props}
        disabled={disabled ?? undefined}
        style={[style, styles.tabButton]}
      />
    ),
    tabBarIcon: ({ color }) =>
      prominent ? (
        <View style={styles.create}>
          <Icon name={icon} size={24} color={colors.onAction} />
        </View>
      ) : (
        <Icon name={icon} size={21} color={color} />
      ),
    tabBarBadgeStyle: {
      backgroundColor: colors.coral,
      color: colors.onCoral,
    },
  };
}
const styles = StyleSheet.create({
  create: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.action,
    alignItems: "center",
    justifyContent: "center",
  },
  bar: {
    backgroundColor: colors.deepTeal,
    borderTopColor: "transparent",
    borderTopWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 0,
    marginBottom: 0,
    paddingHorizontal: 8,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    elevation: 0,
    shadowOpacity: 0,
  },
  item: { paddingVertical: 0, marginHorizontal: 2, borderRadius: 25 },
  tabButton: { borderRadius: 25 },
  label: {
    ...typography.caption,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0,
    marginTop: 3,
  },
});
