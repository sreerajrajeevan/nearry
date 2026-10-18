import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { colors, typography, radius } from "../theme";

type Props = {
  name: string;
  size?: number;
  tone?: "neutral" | "clay";
  /** Photo URL — when set, shows the image instead of initials. */
  uri?: string;
};

/** Initials avatar, or a photo when uri is provided. */
export function Avatar({ name, size = 44, tone = "neutral", uri }: Props) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return <Image source={{ uri }} style={[styles.photo, round]} />;
  }
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
  photo: {
    backgroundColor: colors.surfaceRaised,
  },
  base: {
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { fontFamily: "System", fontWeight: "500", color: colors.muted },
  clay: { backgroundColor: colors.claySoft },
  clayText: { color: colors.accent },
});
