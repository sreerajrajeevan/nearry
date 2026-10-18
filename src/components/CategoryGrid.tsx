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
          onPress={() => onSelect(selected === key ? null : key)}
          style={[styles.tile, selected === key && styles.selected]}
        >
          <View style={styles.art}>
            <CategoryArt category={key} size={96} />
          </View>
          <View style={styles.arrow}>
            <Icon
              name={selected === key ? "check" : "arrow-up-right"}
              size={14}
              color={selected === key ? colors.accent : colors.textDim}
            />
          </View>
          <Text style={styles.label}>{key}</Text>
          <Text style={styles.hint}>{hint}</Text>
        </MotionPressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 28 },
  tile: {
    flexBasis: "46%",
    flexGrow: 1,
    minHeight: 154,
    padding: 15,
    paddingTop: 100,
    backgroundColor: colors.onAccent,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 23,
    overflow: "hidden",
  },
  selected: { borderColor: colors.accent, backgroundColor: colors.claySoft },
  art: { position: "absolute", top: 0, right: 14 },
  arrow: { position: "absolute", left: 14, top: 17 },
  label: {
    ...typography.heading,
    fontSize: 18,
    color: colors.text,
    marginBottom: 3,
  },
  hint: { ...typography.caption, lineHeight: 16, color: colors.textDim },
});
