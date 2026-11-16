import React, { useEffect } from "react";
import { BackHandler, StyleSheet, Text, View } from "react-native";
import {
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { MotionPressable } from "./Motion";
import { Icon } from "./Icon";
import { useAuth } from "../store/AuthContext";
import { setLeaveDemoHandler } from "../services/demoMessage";
import { navigationRef } from "../navigation/navigationRef";
import { weight } from "../theme";

const NIGHT = "#030712";
const AMBER = "#F59E0B";

/**
 * Always visible while exploring the demo, on every screen of both demos.
 * Screens below it get a zero top inset so nothing sits twice under the bar.
 */
export function DemoFrame({ children }: { children: React.ReactNode }) {
  const { demoMode, exitDemoMode } = useAuth();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!demoMode) return;
    setLeaveDemoHandler(exitDemoMode);
    // Android back on the first demo screen leaves the demo instead of closing the app.
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (navigationRef.isReady() && navigationRef.canGoBack()) return false;
      exitDemoMode();
      return true;
    });
    return () => {
      setLeaveDemoHandler(null);
      back.remove();
    };
  }, [demoMode, exitDemoMode]);

  if (!demoMode) return <>{children}</>;
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View
        style={[styles.bar, { paddingTop: Math.max(insets.top, 8) }]}
        accessibilityRole="summary"
      >
        <View style={styles.label}>
          <View style={styles.dot} />
          <Text style={styles.title} numberOfLines={1}>
            Demo
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            Sample data, nothing is saved
          </Text>
        </View>
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="Leave demo"
          accessibilityHint="Goes back to the start screen to sign up or log in"
          onPress={exitDemoMode}
          style={styles.leave}
          hitSlop={4}
        >
          <Icon name="log-out" size={15} color={NIGHT} />
          <Text style={styles.leaveText}>Leave demo</Text>
        </MotionPressable>
      </View>
      <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
        <View style={styles.body}>{children}</View>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NIGHT },
  bar: {
    backgroundColor: NIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
  },
  label: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
    backgroundColor: AMBER,
  },
  title: { fontSize: 14, color: "#FFFFFF", flexShrink: 0, ...weight("800") },
  sub: { fontSize: 12, color: "#9CA3AF", flexShrink: 1 },
  leave: {
    flexShrink: 0,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: AMBER,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  leaveText: { fontSize: 13, color: NIGHT, ...weight("800") },
  body: { flex: 1, overflow: "hidden" },
});
