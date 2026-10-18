import React from "react";
import {
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  StyleProp,
  TextStyle,
} from "react-native";
import { colors, typography, spacing, radius } from "../theme";
import { MotionPressable } from "./Motion";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type Props = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  style,
}: Props) {
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityState={{
        disabled: !!(disabled || loading),
        busy: !!loading,
      }}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        styles[variant],
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? colors.onAccent : colors.text}
        />
      ) : (
        <Text
          style={[
            styles.text,
            styles[`${variant}Text` as keyof typeof styles] as TextStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  primary: { backgroundColor: colors.red },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  ghost: { backgroundColor: "transparent" },
  danger: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.red,
  },
  disabled: { opacity: 0.4 },
  text: { ...typography.body, fontWeight: "600", color: colors.text },
  primaryText: { color: colors.onAccent },
  secondaryText: { color: colors.text },
  ghostText: { color: colors.textDim },
  dangerText: { color: colors.red },
});
