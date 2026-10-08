import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../theme';

type Props = {
  title: string;
  hint?: string;
};

export function EmptyState({ title, hint }: Props) {
  return (
    <View style={styles.base}>
      <Text style={styles.glyph}>◌</Text>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', paddingVertical: spacing.xxl },
  glyph: { fontSize: 40, color: colors.gray700, marginBottom: spacing.sm },
  title: { ...typography.heading, color: colors.textDim, textAlign: 'center' },
  hint: { ...typography.bodySmall, color: colors.textFaint, textAlign: 'center', marginTop: spacing.sm },
});
