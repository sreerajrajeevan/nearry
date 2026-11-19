import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";
import { Icon, IconName } from "../components/Icon";
import { MotionPressable } from "../components/Motion";
import { colors, weight } from "../theme";

const BAR_HEIGHT = 64;

/**
 * A dark pill that floats above the page. It stays in the normal layout (not
 * absolutely positioned), so screens never scroll content underneath it; the
 * margins around it show the page background and clear the gesture area.
 */
export function useTabBarLayout(): BottomTabNavigationOptions {
  const { bottom } = useSafeAreaInsets();
  return {
    tabBarShowLabel: false,
    tabBarStyle: [
      styles.bar,
      { height: BAR_HEIGHT, marginBottom: Math.max(bottom, 12) },
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
    tabBarAccessibilityLabel: title === "Create Offer" ? "Create offer" : title,
    tabBarActiveTintColor: colors.amberBright,
    tabBarInactiveTintColor: colors.lineStrong,
    tabBarActiveBackgroundColor: "transparent",
    tabBarItemStyle: styles.item,
    // Keep tab switches inside the app on web as well; an anchor reload loses drafts.
    tabBarButton: ({ style, disabled, href: _href, ...props }) => (
      <MotionPressable
        {...props}
        disabled={disabled ?? undefined}
        style={[style, styles.tabButton]}
      />
    ),
    tabBarIcon: ({ color, focused }) =>
      prominent ? (
        <View style={styles.create}>
          <Icon name={icon} size={24} color={colors.onAmber} />
        </View>
      ) : (
        <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
          <Icon name={icon} size={22} color={color} />
        </View>
      ),
    tabBarBadgeStyle: styles.badge,
  };
}
const LIGHT_BAR_HEIGHT = 72;

/** Personal navigation keeps labels in the familiar dark floating pill. */
export function useLightTabBarLayout(): BottomTabNavigationOptions {
  const { bottom } = useSafeAreaInsets();
  return {
    tabBarShowLabel: true,
    tabBarStyle: [
      styles.bar,
      { height: LIGHT_BAR_HEIGHT, marginBottom: Math.max(bottom, 12) },
    ],
  };
}

export function lightTabOptions(
  icon: IconName,
  title: string,
  prominent = false,
): BottomTabNavigationOptions {
  return {
    title,
    headerShown: false,
    tabBarHideOnKeyboard: true,
    tabBarAccessibilityLabel: title,
    tabBarActiveTintColor: colors.amberBright,
    tabBarInactiveTintColor: "#C5CBD4",
    tabBarActiveBackgroundColor: "transparent",
    tabBarLabelPosition: "below-icon",
    tabBarItemStyle: styles.lightItem,
    tabBarLabelStyle: styles.lightLabel,
    tabBarButton: ({ style, disabled, href: _href, ...props }) => (
      <MotionPressable
        {...props}
        disabled={disabled ?? undefined}
        style={[style, styles.lightTabButton]}
      />
    ),
    tabBarIcon: ({ color, focused }) =>
      prominent ? (
        <View style={styles.lightCreate}>
          <Icon name={icon} size={24} color={colors.onAmber} />
        </View>
      ) : (
        <View
          style={[styles.lightIconWrap, focused && styles.lightIconWrapActive]}
        >
          <Icon name={icon} size={21} color={color} />
        </View>
      ),
    tabBarBadgeStyle: styles.badge,
  };
}

const styles = StyleSheet.create({
  lightItem: {
    height: LIGHT_BAR_HEIGHT,
    paddingVertical: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  lightLabel: { fontSize: 10, lineHeight: 14, marginBottom: 7, ...weight("600") },
  lightTabButton: { borderRadius: 28 },
  lightIconWrap: {
    width: 52,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  lightIconWrapActive: { backgroundColor: "rgba(255,255,255,0.08)" },
  lightCreate: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.amberBright,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  bar: {
    position: "relative",
    backgroundColor: colors.night,
    borderRadius: BAR_HEIGHT / 2,
    borderTopWidth: 0,
    marginHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 8,
    elevation: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  item: {
    height: BAR_HEIGHT,
    paddingVertical: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  tabButton: { borderRadius: BAR_HEIGHT / 2 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: { backgroundColor: "rgba(255,255,255,0.08)" },
  create: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.amberBright,
    borderWidth: 3,
    borderColor: colors.night,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    backgroundColor: colors.amberBright,
    color: colors.onAmber,
    fontSize: 11,
    ...weight("800"),
  },
});
