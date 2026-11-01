import React from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "../theme";

/**
 * Lightweight, artwork-free Nearry atmosphere. Curved ivory/peach layers
 * create a soft editorial backdrop without mapping a real location.
 * All elements are decorative and ignored by screen readers.
 */
export function NearryAtmosphere() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
      <View style={styles.topPeach} />
      <View style={styles.topIvory} />
      <View style={styles.topArc} />
      <View style={styles.midGlow} />
      <View style={styles.bottomPeach} />
      <View style={styles.bottomIvory} />
      <View style={styles.bottomArc} />
    </View>
  );
}

const styles = StyleSheet.create({
  topPeach: {
    position: "absolute",
    top: -380,
    left: -245,
    width: 675,
    height: 600,
    borderRadius: 340,
    backgroundColor: "#F7E9E0",
    transform: [{ rotate: "-22deg" }],
  },
  topIvory: {
    position: "absolute",
    top: -419,
    left: -162,
    width: 675,
    height: 560,
    borderRadius: 340,
    backgroundColor: "#FBF5EE",
    transform: [{ rotate: "-21deg" }],
  },
  topArc: {
    position: "absolute",
    top: -400,
    left: -218,
    width: 690,
    height: 620,
    borderRadius: 350,
    borderWidth: 1,
    borderColor: "#EFD7C8",
    transform: [{ rotate: "-22deg" }],
  },
  midGlow: {
    position: "absolute",
    top: "26%",
    left: "18%",
    width: 270,
    height: 300,
    borderRadius: 160,
    backgroundColor: "#FCF7F2",
    opacity: 0.35,
  },
  bottomPeach: {
    position: "absolute",
    bottom: -430,
    right: -264,
    width: 760,
    height: 640,
    borderRadius: 390,
    backgroundColor: "#F7E9E1",
    transform: [{ rotate: "-26deg" }],
  },
  bottomIvory: {
    position: "absolute",
    bottom: -474,
    right: -186,
    width: 730,
    height: 620,
    borderRadius: 390,
    backgroundColor: "#FAF1E9",
    transform: [{ rotate: "-25deg" }],
  },
  bottomArc: {
    position: "absolute",
    bottom: -435,
    right: -258,
    width: 756,
    height: 634,
    borderRadius: 390,
    borderWidth: 1,
    borderColor: "#EFD9CE",
    transform: [{ rotate: "-25deg" }],
  },
});
