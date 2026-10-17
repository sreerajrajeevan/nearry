import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, radius, spacing } from '../theme';

type Props = {
  label: string;
  tone?: 'red' | 'neutral' | 'green';
};

export function Badge({ label, tone = 'neutral' }: Props) {
  return (
    <View style={[styles.base, styles[tone]]}>
      <Text style={[styles.text, tone === 'red' && styles.redText, tone === 'green' && styles.greenText]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  neutral: { backgroundColor: colors.hairline },
  red: { backgroundColor: colors.clay },
  green: { backgroundColor: colors.hairline },
  text: { ...typography.bodySmall, color: colors.textDim, fontWeight: '600' },
  redText: { color: colors.onAccent },
  greenText: { color: colors.success },
});
