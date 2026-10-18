import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, typography, radius } from "../theme";

type Props = {
  name: string;
  size?: number;
  tone?: "neutral" | "clay";
};

/** Initials avatar — no image dependency for the MVP. */
export function Avatar({ name, size = 44, tone = "neutral" }: Props) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <View
      style={[
        styles.base,
        tone === "clay" && styles.clay,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text
        style={[
          styles.text,
          tone === "clay" && styles.clayText,
          { fontSize: size * 0.38 },
        ]}
      >
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { fontFamily: "System", fontWeight: "500", color: colors.muted },
  clay: { backgroundColor: colors.claySoft },
  clayText: { color: colors.accent },
});
