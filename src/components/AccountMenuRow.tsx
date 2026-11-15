import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Icon, IconName } from "./Icon";
import { MotionPressable } from "./Motion";
import { colors, spacing, typography, weight } from "../theme";

/** A white card of AccountMenuRows with hairline dividers between them. */
export function AccountMenuGroup({ children }: { children: React.ReactNode }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.group}>
      {rows.map((row, index) => (
        <React.Fragment key={index}>
          {index > 0 && <View style={styles.divider} />}
          {row}
        </React.Fragment>
      ))}
    </View>
  );
}

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
  group: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 66,
  },
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
    backgroundColor: colors.sandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, gap: 3 },
  title: { ...typography.body, color: colors.text, ...weight("600") },
  hint: { ...typography.bodySmall, color: colors.textDim },
  count: {
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    ...typography.caption,
    color: colors.onGold,
    ...weight("700"),
  },
});
