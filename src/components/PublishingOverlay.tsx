import React, { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Icon } from "./Icon";
import { colors, weight } from "../theme";

export type PublishPhase = "working" | "done";

/**
 * Full-screen, non-interactive "publishing" moment: a spinning ring while the
 * plan (and its photo) save, then a check that pops in before the plan opens.
 */
export function PublishingOverlay({
  phase,
  editing,
}: {
  phase: PublishPhase | null;
  editing: boolean;
}) {
  const spin = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (phase !== "working") return;
    spin.setValue(0);
    pop.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, spin, pop]);

  useEffect(() => {
    if (phase !== "done") return;
    Animated.spring(pop, {
      toValue: 1,
      friction: 5,
      tension: 140,
      useNativeDriver: true,
    }).start();
    AccessibilityInfo.announceForAccessibility?.(
      editing ? "Changes saved" : "Your plan is live",
    );
  }, [phase, pop, editing]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const title =
    phase === "done"
      ? editing
        ? "Changes saved"
        : "Your plan is live!"
      : editing
        ? "Saving your changes…"
        : "Publishing your plan…";
  const hint =
    phase === "done"
      ? editing
        ? "Everyone in the plan sees the update."
        : "People nearby can see it and ask to join."
      : "This only takes a moment.";

  return (
    <Modal
      visible={phase !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => undefined}
    >
      <View style={styles.backdrop} accessibilityViewIsModal>
        <View style={styles.badge}>
          {phase === "done" ? (
            <Animated.View
              style={[
                styles.check,
                { transform: [{ scale: pop }], opacity: pop },
              ]}
            >
              <Icon name="check" size={44} color={colors.night} />
            </Animated.View>
          ) : (
            <Animated.View style={[styles.ring, { transform: [{ rotate }] }]} />
          )}
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.night,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  badge: {
    width: 104,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  ring: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 6,
    borderColor: "rgba(245,158,11,0.22)",
    borderTopColor: colors.amber,
  },
  check: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.amber,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    color: colors.white,
    textAlign: "center",
    ...weight("800"),
  },
  hint: {
    fontSize: 15,
    lineHeight: 21,
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
    ...weight("500"),
  },
});
