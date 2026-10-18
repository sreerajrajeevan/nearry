import React, { useEffect, useRef } from "react";
import { Animated, View, Text, StyleSheet } from "react-native";
import { colors, typography, spacing } from "../theme";

/** Celebratory card shown when a business becomes verified. */
export function VerifiedWelcome({ businessName }: { businessName: string }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, fade]);

  return (
    <Animated.View
      style={[styles.card, { opacity: fade, transform: [{ scale }] }]}
    >
      <View style={styles.badge}>
        <Text style={styles.check}>✓</Text>
      </View>
      <Text style={styles.title}>Welcome aboard, {businessName}!</Text>
      <Text style={styles.body}>
        You're verified. Your offers can now go live and customers can book
        with confidence.
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.claySoft,
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.clay,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  check: {
    color: colors.onAccent,
    fontSize: 28,
    fontWeight: "700",
  },
  title: {
    ...typography.title,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.body,
    color: colors.textDim,
    textAlign: "center",
  },
});
