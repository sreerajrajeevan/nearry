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
      <Text style={[styles.text, tone === 'red' && styles.redText]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  neutral: { borderColor: colors.borderStrong, backgroundColor: 'transparent' },
  red: { borderColor: colors.red, backgroundColor: colors.red },
  green: { borderColor: colors.success, backgroundColor: 'transparent' },
  text: { ...typography.caption, color: colors.textDim },
  redText: { color: colors.onAccent },
});
