import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  scroll?: boolean;
};

/** Full-screen black canvas with safe-area handling. */
export function Screen({ children, style, padded = true }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={[styles.container, padded && styles.padded, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  padded: {
    paddingHorizontal: spacing.md,
  },
});
