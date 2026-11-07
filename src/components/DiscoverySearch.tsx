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
) & { compact?: boolean };
export function DiscoverySearch(props: Props) {
  if ("onPress" in props)
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Search places, plans and offers"
        onPress={props.onPress}
        activeOpacity={0.7}
        style={[styles.field, props.compact && styles.compact]}
      >
        <Icon name="search" size={18} />
        <Text style={styles.placeholder}>Search places or plans</Text>
      </TouchableOpacity>
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
        clearButtonMode="while-editing"
        selectionColor={colors.accent}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  compact: {
    minHeight: 48,
    backgroundColor: colors.sageSoft,
    borderColor: "transparent",
    borderRadius: 12,
    marginBottom: 8,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    marginBottom: spacing.md,
  },
  placeholder: {
    ...typography.bodySmall,
    color: colors.textDim,
    flex: 1,
    paddingVertical: 14,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
});
