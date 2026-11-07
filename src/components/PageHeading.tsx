import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, typography, spacing, surfaces } from "../theme";

type Props = {
  title: string;
  greeting?: string;
  subtitle?: string;
  compact?: boolean;
  tone?: "forest" | "plain";
};

export function PageHeading({
  title,
  greeting,
  subtitle,
  compact = false,
  tone = "forest",
}: Props) {
  return (
    <View style={[styles.heading, tone === "forest" && styles.forest]}>
      {!!greeting && (
        <Text
          style={[styles.greeting, tone === "forest" && styles.onForestMuted]}
        >
          {greeting}
        </Text>
      )}
      <Text
        accessibilityRole="header"
        style={[
          styles.title,
          compact && styles.compact,
          tone === "forest" && styles.onForest,
        ]}
      >
        {title}
      </Text>
      {!!subtitle && (
        <Text
          style={[styles.subtitle, tone === "forest" && styles.onForestMuted]}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { marginTop: spacing.sm, marginBottom: spacing.lg },
  forest: { ...surfaces.hero },
  onForest: { color: colors.onAccent },
  onForestMuted: { color: colors.goldSoft },
  greeting: {
    ...typography.bodySmall,
    color: colors.textDim,
    marginBottom: 10,
  },
  title: {
    ...typography.display,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.8,
    color: colors.text,
  },
  compact: {
    fontSize: 25,
    lineHeight: 31,
    letterSpacing: -1,
    fontWeight: "600",
  },
  subtitle: {
    ...typography.body,
    color: colors.textDim,
    marginTop: spacing.sm,
  },
});
