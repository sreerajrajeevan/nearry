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

/**
 * Personal navigation: a light bar anchored to the bottom (Material 3 style)
 * with a label on every tab. It sits in the normal layout, so it never covers
 * the feed; the phone's gesture area is added below it as padding.
 */
export function useLightTabBarLayout(): BottomTabNavigationOptions {
  const { bottom } = useSafeAreaInsets();
  const inset = Math.max(bottom, 8);
  return {
    tabBarShowLabel: true,
    tabBarStyle: [
      styles.lightBar,
      { height: LIGHT_BAR_HEIGHT + inset, paddingBottom: inset },
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
    tabBarActiveTintColor: colors.ink,
    tabBarInactiveTintColor: colors.lineStrong,
    tabBarActiveBackgroundColor: "transparent",
    tabBarLabelPosition: "below-icon",
    tabBarItemStyle: styles.lightItem,
    tabBarLabelStyle: styles.lightLabel,
    // Create is the big yellow button; its label would only crowd it.
    ...(prominent ? { tabBarLabel: () => null } : {}),
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
  lightBar: {
    position: "relative",
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    paddingTop: 0,
    paddingHorizontal: 4,
    elevation: 0,
    shadowOpacity: 0,
  },
  lightLabel: {
    fontSize: 11,
    lineHeight: 14,
    marginBottom: 8,
    ...weight("700"),
  },
  lightTabButton: { borderRadius: 16 },
  lightIconWrap: {
    width: 56,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  // The active tab gets a soft yellow pill behind its icon.
  lightIconWrapActive: { backgroundColor: colors.amberSoft },
  lightCreate: {
    width: 46,
    height: 46,
    borderRadius: 14,
    // Labelled tabs sit higher; this centres Create in the bar instead.
    marginTop: 16,
    backgroundColor: colors.amberBright,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.amberDeep,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
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
