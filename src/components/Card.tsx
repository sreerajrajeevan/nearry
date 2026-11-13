import React from "react";
import { View, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { colors, spacing, surfaces } from "../theme";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accent?: boolean;
};

/** Shared raised surface for account, booking and verification content. */
export function Card({ children, style, accent }: Props) {
  return (
    <View style={[styles.row, accent && styles.accent, style]}>{children}</View>
  );
}
const styles = StyleSheet.create({
  row: {
    ...surfaces.card,
    padding: spacing.md,
  },
  accent: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
});
