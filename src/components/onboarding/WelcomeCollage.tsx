import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { DemoPhoto, DemoScene } from "../DemoPhoto";
import { ActivityArt } from "../ActivityArt";
import { ActivityArtwork } from "../../utils/activityArtwork";
import { useReducedMotion } from "../../store/MotionContext";
import { weight } from "../../theme";

type Tile =
  | { photo: DemoScene; label: string; h: number }
  | { art: ActivityArtwork; tint: string; label: string; h: number };

const MINT = "#D1FAE5";
const SKY = "#DBEAFE";
const PEACH = "#FEF3C7";
const LILAC = "#EDE9FE";
const ROSE = "#FFE4E6";

/** Three columns of plan-like moments. Middle column drifts the other way. */
const COLUMNS: Tile[][] = [
  [
    { photo: "coffee", label: "☕ Coffee after work", h: 176 },
    { art: "football", tint: MINT, label: "⚽ 5-a-side tonight", h: 128 },
    { art: "kayak", tint: SKY, label: "🛶 Backwater paddle", h: 132 },
    { photo: "walk", label: "🌅 Sunset walk", h: 172 },
    { art: "music", tint: LILAC, label: "🎸 Jam session", h: 124 },
  ],
  [
    { art: "badminton", tint: SKY, label: "🏸 2 spots left", h: 130 },
    { photo: "court", label: "🏸 Doubles at 7", h: 184 },
    { art: "food", tint: PEACH, label: "🍜 Food crawl", h: 124 },
    { art: "wellness", tint: MINT, label: "🧘 Morning yoga", h: 132 },
    { photo: "coffee", label: "☕ 400 m away", h: 168 },
  ],
  [
    { art: "cinema", tint: ROSE, label: "🎬 Movie night", h: 126 },
    { photo: "walk", label: "🚶 Evening stroll", h: 176 },
    { art: "cycling", tint: MINT, label: "🚲 Weekend ride", h: 130 },
    { art: "games", tint: PEACH, label: "♟️ Board games", h: 124 },
    { photo: "court", label: "🏸 Join the game", h: 172 },
  ],
];
const GAP = 12;
const SPEED = 14; // points per second: slow enough to feel calm

function TileView({ tile, width }: { tile: Tile; width: number }) {
  return (
    <View
      style={[
        styles.tile,
        { width, height: tile.h },
        "art" in tile && { backgroundColor: tile.tint },
      ]}
    >
      {"photo" in tile ? (
        <DemoPhoto scene={tile.photo} />
      ) : (
        <View style={styles.art}>
          <ActivityArt
            artwork={tile.art}
            size={Math.min(width, tile.h) * 0.78}
          />
        </View>
      )}
      <View style={styles.chip}>
        <Text style={styles.chipText} numberOfLines={1}>
          {tile.label}
        </Text>
      </View>
    </View>
  );
}

function Column({
  tiles,
  width,
  reverse,
}: {
  tiles: Tile[];
  width: number;
  reverse: boolean;
}) {
  const reduced = useReducedMotion();
  const loop = tiles.reduce((sum, t) => sum + t.h + GAP, 0);
  const shift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) {
      shift.setValue(0.35);
      return;
    }
    shift.setValue(0);
    const animation = Animated.loop(
      Animated.timing(shift, {
        toValue: 1,
        duration: (loop / SPEED) * 1000,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== "web",
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [reduced, loop, shift]);
  const translateY = shift.interpolate({
    inputRange: [0, 1],
    outputRange: reverse ? [-loop, 0] : [0, -loop],
  });
  return (
    <Animated.View style={{ width, gap: GAP, transform: [{ translateY }] }}>
      {[...tiles, ...tiles].map((tile, i) => (
        <TileView key={i} tile={tile} width={width} />
      ))}
    </Animated.View>
  );
}

/** Decorative, slowly drifting collage behind the welcome headline. */
export function WelcomeCollage({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const span = width * 1.32;
  const columnWidth = (span - GAP * 2) / 3;
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.frame, { height }]}
    >
      <View
        style={[
          styles.tilt,
          { width: span, left: (width - span) / 2, top: -90 },
        ]}
      >
        {COLUMNS.map((tiles, i) => (
          <View
            key={i}
            style={{ marginTop: i === 1 ? -70 : i === 2 ? -30 : 0 }}
          >
            <Column tiles={tiles} width={columnWidth} reverse={i === 1} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  tilt: {
    position: "absolute",
    flexDirection: "row",
    gap: GAP,
    transform: [{ rotate: "-7deg" }],
  },
  tile: {
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#1F2937",
  },
  art: { flex: 1, alignItems: "center", justifyContent: "center" },
  chip: {
    position: "absolute",
    left: 8,
    bottom: 8,
    maxWidth: "88%",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  chipText: {
    fontSize: 11,
    lineHeight: 14,
    color: "#111827",
    ...weight("700"),
  },
});
