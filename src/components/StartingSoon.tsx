import React, { useEffect, useRef } from "react";
import { useMyRequests } from "../store/MyRequestsContext";
import {
  Animated,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { NeedPost } from "../services/mappers";
import { PlanCover } from "./PlanCover";
import { EnterView, MotionPressable } from "./Motion";
import { Icon } from "./Icon";
import { useMotionPreference } from "../store/MotionContext";
import { CardLocation } from "./CardLocation";
import { useCardDistanceOrigin } from "../store/CardDistanceContext";
import { cardDistance, type DistanceOrigin } from "../utils/cardDistance";
import { spotsLeftLabel, startsInLabel } from "../utils/planDiscovery";
import { colors, typography, weight } from "../theme";

const LIVE_RED = "#EF4444";

/** A red dot with a soft ring that pulses, or stays still with reduced motion. */
function LiveDot() {
  const motion = useMotionPreference();
  const pulse = useRef(new Animated.Value(0)).current;
  const still = !motion.ready || motion.reduced;
  useEffect(() => {
    if (still) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: Platform.OS !== "web",
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [still, pulse]);
  return (
    <View style={styles.dotWrap} accessible={false}>
      {!still && (
        <Animated.View
          style={[
            styles.ring,
            {
              opacity: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.55, 0],
              }),
              transform: [
                {
                  scale: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 2.6],
                  }),
                },
              ],
            },
          ]}
        />
      )}
      <View style={styles.dot} />
    </View>
  );
}

/** Home row of plans that start within the next few hours and still have room. */
export function StartingSoon({
  posts,
  now,
  distanceOf,
  distanceOrigin,
  onOpen,
}: {
  posts: NeedPost[];
  now: Date;
  distanceOf: (post: NeedPost) => number | undefined;
  distanceOrigin?: DistanceOrigin;
  onOpen: (postId: string) => void;
}) {
  const mine = useMyRequests()?.statuses;
  const origin = useCardDistanceOrigin();
  const venueIds = posts
    .map((p) => p.venueId)
    .filter(Boolean)
    .join(",");
  useEffect(() => {
    for (const post of posts)
      if (post.venueId) origin?.ensureVenue(post.venueId);
  }, [venueIds, origin?.ensureVenue]);
  if (!posts.length) return null;
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <LiveDot />
        <Text accessibilityRole="header" style={styles.title}>
          Starting soon
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {posts.map((post, index) => {
          const startsIn = startsInLabel(post.startsAt, now);
          const status = mine?.get(post.id);
          const spots =
            status === "pending"
              ? "Requested"
              : status === "approved"
                ? "You're in"
                : spotsLeftLabel(post.spotsLeft);
          const venue = post.venueId
            ? origin?.venues.get(post.venueId)
            : undefined;
          const distance = cardDistance(
            origin?.origin,
            post.location ?? venue?.point,
            { km: distanceOf(post), origin: distanceOrigin },
          );
          return (
            <EnterView key={post.id} index={index}>
              <MotionPressable
                accessibilityRole="button"
                accessibilityLabel={[
                  post.title,
                  startsIn,
                  spots,
                  distance?.label,
                  "View plan",
                ]
                  .filter(Boolean)
                  .join(". ")}
                onPress={() => onOpen(post.id)}
                style={styles.card}
              >
                <View style={StyleSheet.absoluteFill}>
                  <PlanCover post={post} fill artworkSize={70} />
                </View>
                <LinearGradient
                  pointerEvents="none"
                  colors={["rgba(3,7,18,0.35)", "rgba(3,7,18,0.92)"]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.live}>
                  <LiveDot />
                  <Text style={styles.liveText}>{startsIn}</Text>
                </View>
                <View style={styles.copy}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {post.title}
                  </Text>
                  <View style={styles.metaRow}>
                    <Icon
                      name={
                        status === "pending"
                          ? "clock"
                          : status === "approved"
                            ? "check"
                            : "users"
                      }
                      size={13}
                      color={colors.amberBright}
                    />
                    <Text style={styles.spots}>{spots}</Text>
                  </View>
                  <CardLocation light distance={distance?.label} />
                </View>
              </MotionPressable>
            </EnterView>
          );
        })}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  section: { marginTop: 8, marginBottom: 20 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  title: { ...typography.heading, fontSize: 20, ...weight("800") },
  row: { gap: 12, paddingRight: 16 },
  card: {
    width: 220,
    minHeight: 180,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: colors.night,
    justifyContent: "space-between",
    gap: 18,
    padding: 12,
  },
  live: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 9,
    paddingRight: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(3,7,18,0.72)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.55)",
  },
  liveText: {
    fontSize: 12,
    lineHeight: 16,
    color: "#FFFFFF",
    ...weight("800"),
  },
  copy: { gap: 4 },
  cardTitle: {
    fontSize: 16,
    lineHeight: 21,
    color: "#FFFFFF",
    ...weight("800"),
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  spots: { fontSize: 12, color: colors.amberBright, ...weight("800") },
  meta: { fontSize: 12, color: "rgba(255,255,255,0.8)", ...weight("600") },
  dotWrap: {
    width: 10,
    height: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: LIVE_RED },
  ring: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: LIVE_RED,
  },
});
