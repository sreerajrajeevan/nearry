import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Icon } from "./Icon";
import { colors, typography, weight } from "../theme";

/** Wrap the complete location line; the useful distance must never be ellipsized. */
export function CardLocation({
  name,
  distance,
  light = false,
}: {
  name?: string;
  distance?: string;
  light?: boolean;
}) {
  if (!name && !distance) return null;
  const color = light ? "#FFFFFF" : colors.textDim;
  return (
    <View style={styles.row}>
      <Icon
        name="map-pin"
        size={13}
        color={light ? colors.amberBright : colors.amberDeep}
      />
      <Text style={[styles.text, { color }]}>
        {name}
        {name && distance ? " · " : ""}
        <Text style={styles.distance}>{distance}</Text>
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 5, marginTop: 4 },
  text: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
    minWidth: 0,
  },
  distance: { ...weight("600") },
});
