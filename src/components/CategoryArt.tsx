import React from "react";
import { Image, View } from "react-native";
import { DiscoveryCategory } from "../utils/discovery";

const atlas = require("../../assets/discovery/category-scenes.png");
const atlasSize = 1254;
// Scene bounds include their transparent gutters; keep neighbouring art out.
const regions: Record<DiscoveryCategory, [number, number, number, number]> = {
  Play: [0, 0, 680, 560],
  Meet: [680, 0, 574, 625],
  Explore: [0, 560, 660, 694],
  Unwind: [660, 625, 594, 629],
};

/** Fit one scene from the shared atlas without stretching its proportions. */
export function CategoryArt({
  category,
  size = 88,
}: {
  category: DiscoveryCategory;
  size?: number;
}) {
  const [x, y, width, height] = regions[category];
  const scale = size / Math.max(width, height);
  return (
    <View
      accessible={false}
      pointerEvents="none"
      style={{ width: size, height: size, overflow: "hidden" }}
    >
      <View
        style={{
          position: "absolute",
          left: (size - width * scale) / 2,
          top: (size - height * scale) / 2,
          width: width * scale,
          height: height * scale,
          overflow: "hidden",
        }}
      >
        <Image
          source={atlas}
          resizeMode="stretch"
          fadeDuration={0}
          style={{
            position: "absolute",
            width: atlasSize * scale,
            height: atlasSize * scale,
            left: -x * scale,
            top: -y * scale,
          }}
        />
      </View>
    </View>
  );
}
