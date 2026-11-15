import React from "react";
import { StyleSheet, TouchableOpacity, ViewStyle } from "react-native";
import { Icon } from "./Icon";
import { colors } from "../theme";

/** The one back control for full-page screens: a round button, top left. */
export function BackButton({
  onPress,
  disabled,
  style,
}: {
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={[styles.button, disabled && styles.disabled, style]}
    >
      <Icon name="arrow-left" size={20} color={colors.text} />
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  disabled: { opacity: 0.5 },
});
