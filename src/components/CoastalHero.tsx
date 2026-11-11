import React from "react";
import { ImageBackground, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme";

/** Decorative scenery only. Venue and plan photos always come from their owners. */
export function CoastalHero({
  children,
  compact = false,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <View style={[styles.shell, compact && styles.compact]}>
      <ImageBackground
        source={require("../../assets/coastal/kochicoast.jpg")}
        resizeMode="cover"
        imageStyle={{ width: "100%", height: "100%" }}
        style={styles.image}
      >
        <LinearGradient
          colors={["rgba(0,40,45,0.08)", "rgba(0,40,45,0.45)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.content}
        >
          {children}
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}
const styles = StyleSheet.create({
  shell: {
    backgroundColor: colors.deepTeal,
    overflow: "hidden",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  compact: { borderRadius: 28 },
  image: { width: "100%" },
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 20 },
});
