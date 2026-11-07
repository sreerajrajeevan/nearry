import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, typography } from "../theme";
import { DiscoveryCategory } from "../utils/discovery";
import { CategoryArt } from "./CategoryArt";
import { MotionPressable } from "./Motion";
import { Icon } from "./Icon";

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
          <CategoryArt category={key} size={52} />
          <Text style={styles.label}>{key}</Text>
          {selected === key && (
            <View style={styles.check}>
              <Icon name="check" size={10} color={colors.onGold} />
            </View>
          )}
        </MotionPressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  tile: {
    flexBasis: "22%",
    flexGrow: 1,
    minHeight: 96,
    paddingHorizontal: 2,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 14,
  },
  selected: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.sageSoft,
  },
  label: { ...typography.label, fontSize: 12, color: colors.text },
  check: {
    position: "absolute",
    right: 3,
    top: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
});
