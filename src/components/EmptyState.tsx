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
  base: { alignItems: "center", paddingVertical: spacing.xxl },
  glyph: { marginBottom: spacing.md },
  title: { ...typography.heading, color: colors.textDim, textAlign: "center" },
  hint: {
    ...typography.bodySmall,
    color: colors.textDim,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
