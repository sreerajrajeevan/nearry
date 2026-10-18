import React from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from "react-native";
import { colors, typography, spacing } from "../theme";

type Props = TextInputProps & {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
};

export function Input({ label, error, containerStyle, style, ...rest }: Props) {
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        accessibilityLabel={label || rest.placeholder}
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor={colors.textFaint}
        selectionColor={colors.red}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: {
    ...typography.label,
    color: colors.textDim,
    marginBottom: spacing.sm,
  },
  input: {
    minHeight: 52,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 16,
    backgroundColor: colors.background,
  },
  inputError: { borderColor: colors.red },
  error: { ...typography.caption, color: colors.red, marginTop: spacing.xs },
});
