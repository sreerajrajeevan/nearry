import React from "react";
import { View, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { colors, spacing } from "../theme";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accent?: boolean;
};

/** Shared list surface: generous row spacing and a single quiet divider. */
export function Card({ children, style }: Props) {
  return <View style={[styles.row, style]}>{children}</View>;
}
const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
