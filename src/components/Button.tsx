import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, typography, spacing, radius } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({ title, onPress, variant = 'primary', loading, disabled, style }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[styles.base, styles[variant], disabled && styles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onAccent : colors.text} />
      ) : (
        <Text style={[styles.text, styles[`${variant}Text` as keyof typeof styles] as TextStyle]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primary: { backgroundColor: colors.red },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.borderStrong },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.red },
  disabled: { opacity: 0.4 },
  text: { ...typography.label, color: colors.text },
  primaryText: { color: colors.onAccent },
  secondaryText: { color: colors.text },
  ghostText: { color: colors.textDim },
  dangerText: { color: colors.red },
});
