import React from "react";
import { View, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { colors, radius, spacing } from "../theme";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accent?: boolean;
};

/** Sharp-edged bordered card. `accent` adds a red left rail. */
export function Card({ children, style, accent }: Props) {
  return (
    <View style={[styles.card, accent && styles.accent, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  accent: {
    borderLeftWidth: 3,
    borderLeftColor: colors.red,
  },
});
