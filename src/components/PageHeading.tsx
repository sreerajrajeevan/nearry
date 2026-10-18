import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, typography, spacing } from "../theme";

type Props = {
  title: string;
  greeting?: string;
  subtitle?: string;
  compact?: boolean;
};

export function PageHeading({
  title,
  greeting,
  subtitle,
  compact = false,
}: Props) {
  return (
    <View style={styles.heading}>
      {!!greeting && <Text style={styles.greeting}>{greeting}</Text>}
      <Text
        accessibilityRole="header"
        style={[styles.title, compact && styles.compact]}
      >
        {title}
      </Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { marginTop: spacing.sm, marginBottom: spacing.lg },
  greeting: {
    ...typography.bodySmall,
    color: colors.textDim,
    marginBottom: 10,
  },
  title: { ...typography.display, color: colors.text },
  compact: {
    fontSize: 31,
    lineHeight: 36,
    letterSpacing: -1,
    fontWeight: "600",
  },
  subtitle: {
    ...typography.body,
    color: colors.textDim,
    marginTop: spacing.sm,
  },
});
