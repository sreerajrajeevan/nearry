import React, { useEffect, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, View } from "react-native";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { colors } from "../theme";
import { useReducedMotion } from "../store/MotionContext";
import { haptic } from "../services/haptics";

const AVATAR = 92;
const RING = AVATAR + 12; // 4 padding + 2 border on each side
const BADGE = 56; // celebration size; it settles at half size in the corner
const SETTLED = 0.5;
// Centre of the corner dot (28pt, 2pt in from the ring edge) from the ring centre.
const CORNER = RING / 2 - 2 - (BADGE * SETTLED) / 2;
const native = Platform.OS !== "web";
const SPARKS = Array.from({ length: 10 }, (_, i) => {
  const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
  const reach = i % 2 ? 70 : 84;
  return {
    x: Math.cos(angle) * reach,
    y: Math.sin(angle) * reach,
    color: i % 2 ? colors.amberBright : colors.success,
    size: i % 2 ? 6 : 8,
  };
});

type Props = {
  name: string;
  uri?: string;
  verified: boolean;
  /** Play the tick moment once; the green tick then stays in the corner. */
  celebrate?: boolean;
  onCelebrated?: () => void;
};

/**
 * Profile photo with the green verified tick. When `celebrate` turns on, a
 * large tick pops in over the photo, draws itself, then settles into the corner.
 */
export function VerifiedAvatar({
  name,
  uri,
  verified,
  celebrate = false,
  onCelebrated,
}: Props) {
  const reduced = useReducedMotion();
  const settledNow = verified && !celebrate;
  const ring = useRef(new Animated.Value(settledNow ? 1 : 0)).current;
  const pop = useRef(new Animated.Value(settledNow ? 1 : 0)).current;
  const draw = useRef(new Animated.Value(settledNow ? 1 : 0)).current;
  const settle = useRef(new Animated.Value(settledNow ? 1 : 0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const done = useRef(onCelebrated);
  done.current = onCelebrated;

  useEffect(() => {
    if (!verified) {
      [ring, pop, draw, settle].forEach((v) => v.setValue(0));
      return;
    }
    if (!celebrate) {
      [ring, pop, draw, settle].forEach((v) => v.setValue(1));
      return;
    }
    if (reduced) {
      [ring, pop, draw, settle].forEach((v) => v.setValue(1));
      haptic("success");
      done.current?.();
      return;
    }
    [ring, pop, draw, settle, burst, halo, breathe].forEach((v) =>
      v.setValue(0),
    );
    const timing = (
      value: Animated.Value,
      duration: number,
      easing = Easing.out(Easing.cubic),
    ) =>
      Animated.timing(value, {
        toValue: 1,
        duration,
        easing,
        useNativeDriver: native,
      });
    const sequence = Animated.sequence([
      Animated.delay(250),
      Animated.parallel([
        timing(ring, 380),
        timing(breathe, 520, Easing.inOut(Easing.quad)),
        Animated.spring(pop, {
          toValue: 1,
          speed: 14,
          bounciness: 14,
          useNativeDriver: native,
        }),
        Animated.sequence([
          Animated.delay(160),
          timing(draw, 320, Easing.inOut(Easing.cubic)),
        ]),
        timing(burst, 760),
        timing(halo, 1100, Easing.out(Easing.quad)),
      ]),
      Animated.delay(450),
      Animated.spring(settle, {
        toValue: 1,
        speed: 11,
        bounciness: 7,
        useNativeDriver: native,
      }),
    ]);
    const buzz = setTimeout(() => haptic("success"), 330);
    sequence.start(({ finished }) => {
      if (finished) done.current?.();
    });
    return () => {
      clearTimeout(buzz);
      sequence.stop();
    };
    // Values are stable refs; replay only when the inputs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verified, celebrate, reduced]);

  const badgeScale = Animated.multiply(
    pop,
    settle.interpolate({ inputRange: [0, 1], outputRange: [1, SETTLED] }),
  );
  const offset = settle.interpolate({
    inputRange: [0, 1],
    outputRange: [0, CORNER],
  });
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLabel={
        verified ? `${name}. Verified: selfie checked by a reviewer` : name
      }
    >
      {celebrate &&
        [0, 1].map((i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              styles.halo,
              {
                opacity: halo.interpolate({
                  inputRange: [0, i * 0.18, 1],
                  outputRange: [0, 0.32, 0],
                }),
                transform: [
                  {
                    scale: halo.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.55 + i * 0.3],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      <Animated.View
        style={[
          styles.ring,
          {
            transform: [
              {
                scale: breathe.interpolate({
                  inputRange: [0, 0.45, 1],
                  outputRange: [1, 1.06, 1],
                }),
              },
            ],
          },
        ]}
      >
        <Avatar name={name} size={AVATAR} uri={uri} tone="clay" />
        <Animated.View
          pointerEvents="none"
          style={[styles.greenRing, { opacity: ring }]}
        />
      </Animated.View>
      {celebrate &&
        SPARKS.map((spark, i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              styles.spark,
              {
                width: spark.size,
                height: spark.size,
                borderRadius: spark.size / 2,
                marginLeft: -spark.size / 2,
                marginTop: -spark.size / 2,
                backgroundColor: spark.color,
                opacity: burst.interpolate({
                  inputRange: [0, 0.15, 0.7, 1],
                  outputRange: [0, 1, 1, 0],
                }),
                transform: [
                  {
                    translateX: burst.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, spark.x],
                    }),
                  },
                  {
                    translateY: burst.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, spark.y],
                    }),
                  },
                  {
                    scale: burst.interpolate({
                      inputRange: [0, 0.3, 1],
                      outputRange: [0.3, 1.1, 0.5],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      {verified && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.badge,
            {
              transform: [
                { translateX: offset },
                { translateY: offset },
                { scale: badgeScale },
              ],
            },
          ]}
        >
          <Icon name="check" size={28} color="#FFFFFF" />
          {/* Slides away to reveal the tick from left to right. */}
          <Animated.View
            style={[
              styles.cover,
              {
                transform: [
                  {
                    translateX: draw.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, BADGE],
                    }),
                  },
                ],
              },
            ]}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: RING,
    height: RING,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    padding: 4,
    borderRadius: RING / 2,
    borderWidth: 2,
    borderColor: colors.amberBright,
  },
  greenRing: {
    position: "absolute",
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: RING / 2,
    borderWidth: 2,
    borderColor: colors.success,
  },
  halo: {
    position: "absolute",
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    backgroundColor: colors.success,
  },
  spark: { position: "absolute", left: RING / 2, top: RING / 2 },
  badge: {
    position: "absolute",
    left: (RING - BADGE) / 2,
    top: (RING - BADGE) / 2,
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    borderWidth: 6,
    borderColor: colors.white,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cover: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.success,
  },
});
