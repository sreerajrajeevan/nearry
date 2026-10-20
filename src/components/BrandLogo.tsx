import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { colors } from "../theme";

export const BRAND_ASSETS = [
  require("../../assets/brand/pin.png"),
  require("../../assets/brand/wordmark.png"),
];

/** Approved Around You artwork. Keep the nearby point separate from the pin. */
export function BrandMark({
  size = 48,
  color = colors.ink,
  dotColor = colors.clay,
}: {
  size?: number;
  color?: string;
  dotColor?: string;
}) {
  return (
    <View style={{ width: size, height: size }} accessible={false}>
      <Image
        source={BRAND_ASSETS[0]}
        style={{ width: size, height: size, tintColor: color }}
        fadeDuration={0}
        accessible={false}
      />
      <View
        style={{
          position: "absolute",
          left: (size * 198) / 256,
          top: (size * 96) / 256,
          width: (size * 36) / 256,
          height: (size * 36) / 256,
          borderRadius: size,
          backgroundColor: dotColor,
        }}
      />
    </View>
  );
}

export function BrandWordmark({
  width = 164,
  color = colors.ink,
}: {
  width?: number;
  color?: string;
}) {
  return (
    <Image
      source={BRAND_ASSETS[1]}
      style={{ width, height: (width * 137) / 574, tintColor: color }}
      fadeDuration={0}
      accessible={false}
    />
  );
}

export function BrandLogo({ width = 148 }: { width?: number }) {
  return (
    <View
      style={[styles.row, { width, gap: width * 0.033 }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Nearry"
    >
      <BrandMark size={width * 0.26} />
      <BrandWordmark width={width * 0.707} />
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", flexShrink: 0 },
});
