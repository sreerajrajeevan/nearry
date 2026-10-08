import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, radius } from '../theme';

type Props = {
  name: string;
  size?: number;
};

/** Initials avatar — no image dependency for the MVP. */
export function Avatar({ name, size = 44 }: Props) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <View style={[styles.base, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.text, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.gray800,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontFamily: 'monospace', fontWeight: '700', color: colors.text },
});
