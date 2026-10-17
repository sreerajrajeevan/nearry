import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors, typography, spacing } from "../theme";
import { Icon } from "./Icon";

type Props = {
  context?: string;
  onContextPress?: () => void;
  location?: boolean;
};

export function BrandHeader({
  context,
  onContextPress,
  location = false,
}: Props) {
  const contextContent = (
    <>
      {location && <Icon name="map-pin" size={13} />}
      <Text style={styles.context} numberOfLines={1}>
        {context}
      </Text>
      {onContextPress && <Icon name="chevron-down" size={13} />}
    </>
  );
  return (
    <View style={styles.header}>
      <View style={styles.brand} accessibilityLabel="Nearry">
        <View style={styles.mark}>
          <View style={styles.tail} />
        </View>
        <Text style={styles.wordmark}>nearry</Text>
      </View>
      {!!context &&
        (onContextPress ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Change location, ${context}`}
            onPress={onContextPress}
            style={styles.contextButton}
            activeOpacity={0.65}
          >
            {contextContent}
          </TouchableOpacity>
        ) : (
          <View style={styles.contextButton}>{contextContent}</View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexShrink: 0,
  },
  mark: {
    width: 21,
    height: 18,
    borderRadius: 6,
    borderBottomLeftRadius: 1,
    backgroundColor: colors.accent,
  },
  tail: {
    position: "absolute",
    bottom: -4,
    left: 0,
    width: 6,
    height: 8,
    borderBottomRightRadius: 6,
    backgroundColor: colors.accent,
  },
  wordmark: {
    color: colors.text,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "600",
    letterSpacing: -1.5,
  },
  contextButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 44,
    flexShrink: 1,
    justifyContent: "flex-end",
  },
  context: { ...typography.bodySmall, color: colors.textDim, flexShrink: 1 },
});
