import React from "react";
import {
  Text,
  View,
  StyleSheet,
  ViewStyle,
  StyleProp,
  TextStyle,
} from "react-native";
import { colors, typography, spacing, radius, weight } from "../theme";
import { MotionPressable } from "./Motion";
import { LoadingDots } from "./LoadingDots";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "solid";

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
      accessibilityLabel={loading ? `${title}. In progress` : title}
      accessibilityState={{
        disabled: !!(disabled || loading),
        busy: !!loading,
      }}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        styles[variant],
        disabled && !loading && styles.disabled,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading && (
          <LoadingDots
            color={
              variant === "solid"
                ? colors.onAccent
                : variant === "primary"
                  ? colors.onAmber
                  : variant === "danger"
                    ? colors.red
                    : colors.text
            }
          />
        )}
        <Text
          style={[
            styles.text,
            styles[`${variant}Text` as keyof typeof styles] as TextStyle,
          ]}
        >
          {title}
        </Text>
      </View>
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  content: {
    maxWidth: "100%",
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  base: {
    minHeight: 52,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  primary: { backgroundColor: colors.amber },
  solid: { backgroundColor: colors.night },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  ghost: { backgroundColor: "transparent" },
  danger: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.red,
  },
  disabled: { opacity: 0.45 },
  text: {
    ...typography.body,
    ...weight("600"),
    color: colors.text,
    flexShrink: 1,
    textAlign: "center",
  },
  primaryText: { color: colors.onAmber, ...weight("800") },
  solidText: { color: colors.onAccent, ...weight("700") },
  secondaryText: { color: colors.text },
  ghostText: { color: colors.textDim },
  dangerText: { color: colors.red },
});
