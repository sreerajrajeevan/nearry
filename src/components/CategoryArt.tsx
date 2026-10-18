import React from "react";
import { Image, View } from "react-native";
import { DiscoveryCategory } from "../utils/discovery";

const atlas = require("../../assets/discovery/clay-categories.png");
const positions: Record<DiscoveryCategory, [number, number]> = {
  Play: [0, 0],
  Meet: [1, 0],
  Explore: [0, 1],
  Unwind: [1, 1],
};

/** Render a quadrant of the shared art atlas without duplicating image files. */
export function CategoryArt({
  category,
  size = 88,
}: {
  category: DiscoveryCategory;
  size?: number;
}) {
  const [x, y] = positions[category];
  return (
    <View
      accessible={false}
      pointerEvents="none"
      style={{ width: size, height: size, overflow: "hidden" }}
    >
      <Image
        source={atlas}
        resizeMode="stretch"
        fadeDuration={0}
        style={{
          position: "absolute",
          width: size * 2,
          height: size * 2,
          left: -x * size,
          top: -y * size,
        }}
      />
    </View>
  );
}
