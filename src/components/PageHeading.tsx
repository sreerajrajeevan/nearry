import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, typography, spacing } from "../theme";

type Props = { title: string; greeting?: string; subtitle?: string };

export function PageHeading({ title, greeting, subtitle }: Props) {
  return (
    <View style={styles.heading}>
      {!!greeting && <Text style={styles.greeting}>{greeting}</Text>}
      <Text accessibilityRole="header" style={styles.title}>
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
  subtitle: {
    ...typography.body,
    color: colors.textDim,
    marginTop: spacing.sm,
  },
});
