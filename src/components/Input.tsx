import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TouchableOpacity,
} from "react-native";
import { Icon } from "./Icon";
import { colors, typography, spacing, surfaces } from "../theme";

type Props = TextInputProps & {
  clearable?: boolean;
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
};

export function Input({
  label,
  clearable = false,
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
      <View style={styles.fieldWrap}>
        <TextInput
          accessibilityLabel={label || rest.placeholder}
          style={[
            styles.input,
            style,
            focused && styles.focused,
            error && styles.inputError,
            clearable && { paddingRight: 52 },
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
        {clearable && !!rest.value && rest.editable !== false && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label || "search"}`}
            onPress={() => rest.onChangeText?.("")}
            style={styles.clear}
          >
            <Icon name="x" size={18} color={colors.textDim} />
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldWrap: { position: "relative" },
  clear: {
    position: "absolute",
    right: 4,
    top: 4,
    bottom: 4,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
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
