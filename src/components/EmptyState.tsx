import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, typography, spacing } from "../theme";
import { Icon } from "./Icon";

type Props = {
  title: string;
  hint?: string;
};

export function EmptyState({ title, hint }: Props) {
  return (
    <View style={styles.base}>
      <View style={styles.glyph}>
        <Icon name="inbox" size={24} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    padding: spacing.lg,
    marginVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  glyph: {
    marginBottom: spacing.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...typography.heading, color: colors.text, textAlign: "center" },
  hint: {
    ...typography.bodySmall,
    color: colors.textDim,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
