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
  const inverse = tone === "forest";
  return (
    <View style={[styles.heading, inverse && styles.hero]}>
      {inverse && <View style={styles.stroke} accessible={false} />}
      {!!greeting && (
        <Text style={[styles.greeting, inverse && styles.onHeroMuted]}>
          {greeting}
        </Text>
      )}
      <Text
        accessibilityRole="header"
        style={[
          styles.title,
          compact && styles.compact,
          inverse && styles.onHero,
        ]}
      >
        {title}
      </Text>
      {!!subtitle && (
        <Text style={[styles.subtitle, inverse && styles.onHeroMuted]}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  heading: { marginTop: spacing.sm, marginBottom: spacing.lg },
  hero: { ...surfaces.hero, paddingVertical: 24 },
  stroke: {
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.coral,
    marginBottom: 14,
  },
  onHero: { color: colors.white },
  onHeroMuted: { color: colors.onTeal },
  greeting: { ...typography.bodySmall, color: colors.textDim, marginBottom: 7 },
  title: {
    ...typography.display,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.8,
    color: colors.text,
  },
  compact: {
    fontSize: 26,
    lineHeight: 33,
    letterSpacing: -0.6,
    fontWeight: "700",
  },
  subtitle: {
    ...typography.body,
    color: colors.textDim,
    marginTop: spacing.sm,
  },
});
