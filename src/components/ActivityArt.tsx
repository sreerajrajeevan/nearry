import React from "react";
import { Image, View } from "react-native";
import { ActivityArtwork } from "../utils/activityArtwork";

const atlas = require("../../assets/discovery/activity-miniatures.png");
const positions: Record<ActivityArtwork, [number, number]> = {
  football: [0, 0],
  badminton: [1, 0],
  cricket: [2, 0],
  coffee: [3, 0],
  games: [0, 1],
  food: [1, 1],
  kayak: [2, 1],
  cycling: [3, 1],
  cinema: [0, 2],
  music: [1, 2],
  wellness: [2, 2],
  gathering: [3, 2],
};
// Transparent gutters are measured from the final generated sheet, rather
// than assuming the subjects fall exactly on mathematical grid boundaries.
const columns = [0, 380, 735, 1090, 1448];
const rows = [0, 370, 704, 1086];

export function ActivityArt({
  artwork,
  size = 76,
}: {
  artwork: ActivityArtwork;
  size?: number;
}) {
  const [column, row] = positions[artwork];
  const x = columns[column],
    y = rows[row];
  const width = columns[column + 1] - x,
    height = rows[row + 1] - y;
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
            width: 1448 * scale,
            height: 1086 * scale,
            left: -x * scale,
            top: -y * scale,
          }}
        />
      </View>
    </View>
  );
}
