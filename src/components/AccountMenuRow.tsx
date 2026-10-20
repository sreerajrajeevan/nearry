import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Icon, IconName } from "./Icon";
import { MotionPressable } from "./Motion";
import { colors, spacing, typography } from "../theme";

export function AccountMenuRow({
  icon,
  title,
  hint,
  count = 0,
  onPress,
}: {
  icon: IconName;
  title: string;
  hint: string;
  count?: number;
  onPress: () => void;
}) {
  return (
    <MotionPressable
      onPress={onPress}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `${title}, ${count} unread` : title}
      accessibilityHint={hint}
    >
      <View style={styles.icon}>
        <Icon name={icon} size={20} color={colors.ink} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      {count > 0 && (
        <View style={styles.count}>
          <Text style={styles.countText}>{count > 99 ? "99+" : count}</Text>
        </View>
      )}
      <Icon name="chevron-right" size={18} />
    </MotionPressable>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 80,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, gap: 3 },
  title: { ...typography.body, color: colors.text, fontWeight: "600" },
  hint: { ...typography.bodySmall, color: colors.textDim },
  count: {
    backgroundColor: colors.claySoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    ...typography.caption,
    color: colors.clayDeep,
    fontWeight: "700",
  },
});
