import React, { useState } from "react";
import { Image, StyleSheet, View } from "react-native";

export type DemoScene = "coffee" | "court" | "walk";
/** Generated sample photography, used only by explicit demo fixtures. */
export function DemoPhoto({ scene }: { scene: DemoScene }) {
  const [frame, setFrame] = useState({ width: 1, height: 1 });
  const size = Math.max(frame.width, frame.height);
  const index = { coffee: 0, court: 1, walk: 2 }[scene];
  return (
    <View
      pointerEvents="none"
      style={styles.frame}
      onLayout={({ nativeEvent }) => setFrame(nativeEvent.layout)}
    >
      <Image
        source={require("../../assets/discovery/demo-scenes.jpg")}
        accessible={false}
        resizeMode="stretch"
        style={{
          position: "absolute",
          width: size * 3,
          height: size,
          left: -index * size + (frame.width - size) / 2,
          top: (frame.height - size) / 2,
        }}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  frame: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
});
