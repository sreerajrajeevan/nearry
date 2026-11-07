import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from "react-native";
import { colors, typography, spacing, surfaces } from "../theme";

type Props = TextInputProps & {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
};

export function Input({
  label,
  error,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        accessibilityLabel={label || rest.placeholder}
        style={[
          styles.input,
          style,
          focused && styles.focused,
          error && styles.inputError,
        ]}
        placeholderTextColor={colors.textFaint}
        selectionColor={colors.accent}
        {...rest}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
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
    ...surfaces.field,
    minHeight: 52,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  focused: { borderColor: colors.forest, backgroundColor: colors.sageSoft },
  inputError: { borderColor: colors.red },
  error: { ...typography.caption, color: colors.red, marginTop: spacing.xs },
});
