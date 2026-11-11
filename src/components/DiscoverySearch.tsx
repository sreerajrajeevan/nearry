import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { colors, spacing, typography } from "../theme";
import { Icon } from "./Icon";

type Props = (
  | { onPress: () => void }
  | { value: string; onChangeText: (value: string) => void }
) & {
  compact?: boolean;
  onFilterPress?: () => void;
  filtersOpen?: boolean;
  filtersActive?: boolean;
};
export function DiscoverySearch(props: Props) {
  if ("onPress" in props)
    return (
      <View style={[styles.field, props.compact && styles.compact]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Search places, plans and offers"
          onPress={props.onPress}
          activeOpacity={0.7}
          style={styles.searchAction}
        >
          <Icon name="search" size={18} />
          <Text style={styles.placeholder} numberOfLines={1}>
            {props.compact
              ? "Find plans, places and offers"
              : "Search places or plans"}
          </Text>
        </TouchableOpacity>
        {props.onFilterPress && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              props.filtersActive
                ? "Filter and sort plans, options applied"
                : "Filter and sort plans"
            }
            accessibilityState={{ expanded: props.filtersOpen }}
            onPress={props.onFilterPress}
            activeOpacity={0.7}
            style={styles.filterAction}
          >
            <Icon name="sliders" size={18} color={colors.forest} />
            {props.filtersActive && <View style={styles.filterDot} />}
          </TouchableOpacity>
        )}
      </View>
    );
  return (
    <View style={[styles.field, props.compact && styles.compact]}>
      <Icon name="search" size={18} />
      <TextInput
        accessibilityLabel="Search nearby"
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder="Search places or plans"
        placeholderTextColor={colors.textDim}
        style={styles.input}
        autoCapitalize="none"
        returnKeyType="search"
        maxLength={120}
        clearButtonMode="never"
        selectionColor={colors.accent}
      />
      {!!props.value && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => props.onChangeText("")}
          style={styles.clear}
        >
          <Icon name="x" size={18} color={colors.textDim} />
        </TouchableOpacity>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  compact: {
    minHeight: 54,
    backgroundColor: colors.surface,
    borderColor: "transparent",
    borderRadius: 28,
    marginBottom: 0,
    paddingHorizontal: 12,
    gap: 0,
  },
  searchAction: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  filterAction: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -5,
    borderRadius: 24,
    backgroundColor: colors.sandSoft,
  },
  filterDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.forest,
  },
  clear: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -10,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 28,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    marginBottom: spacing.md,
  },
  placeholder: {
    ...typography.bodySmall,
    color: colors.textDim,
    flex: 1,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
});
