import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BrandMark } from "./BrandLogo";
import { LoadingDots } from "./LoadingDots";
import { useMotionActive } from "../hooks/useMotionActive";
import { colors, spacing, typography } from "../theme";

type Layout = "list" | "detail" | "compact" | "inline";

export function LoadingState({
  label = "Finding what’s nearby…",
  layout = "list",
  fullScreen = false,
}: {
  label?: string;
  layout?: Layout;
  fullScreen?: boolean;
}) {
  const active = useMotionActive();
  const pulse = useRef(new Animated.Value(0)).current;
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    const timer = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(timer);
  }, [label]);
  useEffect(() => {
    pulse.setValue(0);
    if (!active) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.quad),
          isInteraction: false,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 750,
          easing: Easing.inOut(Easing.quad),
          isInteraction: false,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    animation.start();
    return () => {
      animation.stop();
      pulse.stopAnimation();
      pulse.setValue(0);
    };
  }, [active, pulse]);
  const skeleton = (style: object) => <View style={[styles.bone, style]} />;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={[
        styles.base,
        fullScreen && styles.full,
        layout === "inline" && styles.inline,
        layout === "compact" && styles.compact,
      ]}
    >
      <View style={styles.status}>
        {layout !== "inline" && (
          <Animated.View
            style={{
              transform: [
                {
                  scale: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.035],
                  }),
                },
              ],
            }}
          >
            <BrandMark size={layout === "compact" ? 30 : 40} />
          </Animated.View>
        )}
        <Text accessibilityLiveRegion="polite" style={styles.label}>
          {label}
        </Text>
        {layout === "inline" && <LoadingDots />}
      </View>
      {(layout === "list" || layout === "detail") && (
        <Animated.View
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.placeholders,
            {
              opacity: active
                ? pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.55, 1],
                  })
                : 1,
            },
          ]}
        >
          {layout === "detail" &&
            skeleton({
              height: 138,
              width: "100%",
              borderRadius: 20,
              marginBottom: 20,
            })}
          {[0, 1].map((i) => (
            <View key={i} style={styles.row}>
              {skeleton({ width: 56, height: 56, borderRadius: 16 })}
              <View style={styles.lines}>
                {skeleton({ width: i ? "62%" : "80%", height: 12 })}
                {skeleton({ width: "49%", height: 9, marginTop: 11 })}
              </View>
            </View>
          ))}
        </Animated.View>
      )}
      {slow && (
        <Text accessibilityLiveRegion="polite" style={styles.slow}>
          Taking longer than usual. Check your connection.
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  base: { paddingVertical: spacing.lg, width: "100%" },
  full: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
  },
  compact: { paddingVertical: spacing.md },
  inline: { paddingVertical: spacing.sm },
  status: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  label: { ...typography.bodySmall, color: colors.textDim, flexShrink: 1 },
  placeholders: {
    marginTop: spacing.lg,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lines: { flex: 1 },
  bone: { backgroundColor: colors.surfaceRaised, borderRadius: 8 },
  slow: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: "center",
    marginTop: spacing.md,
  },
});
