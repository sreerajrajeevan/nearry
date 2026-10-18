import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, typography, spacing } from "../theme";
import { Icon, IconName } from "./Icon";

type Option<T extends string> = { key: T; label: string; icon?: IconName };
type Props<T extends string> = {
  options: Option<T>[];
  selected: T | null;
  onSelect: (key: T) => void;
  label: string;
};

export function FilterTabs<T extends string>({
  options,
  selected,
  onSelect,
  label,
}: Props<T>) {
  return (
    <View
      style={styles.tabs}
      accessibilityRole="tablist"
      accessibilityLabel={label}
    >
      {options.map((option) => {
        const active = option.key === selected;
        return (
          <TouchableOpacity
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(option.key)}
            activeOpacity={0.65}
            style={[styles.tab, active && styles.active]}
          >
            {option.icon && (
              <Icon
                name={option.icon}
                size={15}
                color={active ? colors.onAccent : colors.textDim}
              />
            )}
            <Text style={[styles.label, active && styles.activeLabel]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    backgroundColor: colors.card,
  },
  active: { backgroundColor: colors.accent, borderColor: colors.accent },
  label: { ...typography.bodySmall, color: colors.textDim },
  activeLabel: { color: colors.onAccent, fontWeight: "500" },
});
