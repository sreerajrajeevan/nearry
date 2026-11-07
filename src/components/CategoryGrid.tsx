import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, typography } from "../theme";
import { DiscoveryCategory } from "../utils/discovery";
import { CategoryArt } from "./CategoryArt";
import { MotionPressable } from "./Motion";

const categories: { key: DiscoveryCategory; hint: string }[] = [
  { key: "Play", hint: "Find your next game" },
  { key: "Meet", hint: "Good company, nearby" },
  { key: "Explore", hint: "Try a different kind of day" },
  { key: "Unwind", hint: "Make time for yourself" },
];

export function CategoryGrid({
  selected,
  onSelect,
}: {
  selected: DiscoveryCategory | null;
  onSelect: (category: DiscoveryCategory | null) => void;
}) {
  return (
    <View
      style={styles.grid}
      accessibilityRole="tablist"
      accessibilityLabel="What are you up for?"
    >
      {categories.map(({ key, hint }) => (
        <MotionPressable
          key={key}
          accessibilityRole="tab"
          accessibilityLabel={`${key}. ${hint}`}
          accessibilityState={{ selected: selected === key }}
          aria-selected={selected === key}
          onPress={() => onSelect(selected === key ? null : key)}
          style={[styles.tile, selected === key && styles.selected]}
        >
          <CategoryArt category={key} size={32} />
          <Text style={styles.label}>{key}</Text>
        </MotionPressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  tile: {
    flexBasis: "22%",
    flexGrow: 1,
    minHeight: 64,
    paddingHorizontal: 2,
    paddingVertical: 5,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 14,
  },
  selected: {
    borderColor: colors.border,
    backgroundColor: colors.sageSoft,
  },
  label: { ...typography.label, fontSize: 12, color: colors.text },
});
