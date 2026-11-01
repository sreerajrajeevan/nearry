import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BrandMark, BrandWordmark } from "./BrandLogo";
import { NearryAtmosphere } from "./NearryAtmosphere";
import { LoadingDots } from "./LoadingDots";
import { Button } from "./Button";
import { useMotionPreference } from "../store/MotionContext";
import { colors, typography } from "../theme";

/**
 * A real brand animation, not a static logo or geographic flyover.
 *
 * Native launch frame: one burnt-orange point.
 * React: point -> borderless globe -> inward arrival -> original pin/wordmark.
 * The small orbiting spark visually settles at the exact orange dot in the
 * approved BrandMark. The assets themselves are never redrawn.
 */
export function StartupSplash({
  active = true,
  ready = false,
  onFinish,
  onRetry,
}: {
  active?: boolean;
  ready?: boolean;
  onFinish?: () => void;
  onRetry?: () => void;
}) {
  const { ready: preferenceReady, reduced } = useMotionPreference();
  const [settled, setSettled] = useState(false);
  const [slow, setSlow] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const finish = useRef(onFinish);
  finish.current = onFinish;
  const nativeDriver = Platform.OS !== "web";

  const step = (inputRange: number[], outputRange: number[]) =>
    progress.interpolate({ inputRange, outputRange, extrapolate: "clamp" });

  useEffect(() => {
    const timeout = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!active || !preferenceReady) return;
    if (reduced) {
      progress.setValue(1);
      setSettled(true);
      return;
    }
    setSettled(false);
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 2050,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: nativeDriver,
    });
    animation.start(({ finished }) => {
      if (finished) setSettled(true);
    });
    return () => animation.stop();
  }, [active, preferenceReady, reduced, progress, nativeDriver]);

  useEffect(() => {
    if (!ready || !settled) return;
    if (reduced) {
      finish.current?.();
      return;
    }
    const animation = Animated.timing(fade, {
      toValue: 0,
      duration: 270,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: nativeDriver,
    });
    animation.start(({ finished }) => {
      if (finished) finish.current?.();
    });
    return () => animation.stop();
  }, [ready, settled, reduced, fade, nativeDriver]);

  return (
    <Animated.View
      style={[styles.screen, { opacity: fade }]}
      accessibilityRole="progressbar"
      accessibilityState={{ busy: !ready }}
      accessibilityLabel="Opening Nearry"
    >
      <NearryAtmosphere />
      <View style={styles.stage} accessible={false} pointerEvents="none">
        {!reduced && (
          <>
            <Animated.View style={[
              styles.sparkHalo,
              {
                opacity: step([0, 0.06, 0.2, 0.41], [0.4, 0.72, 0.4, 0]),
                transform: [{ scale: step([0, 0.18, 0.4], [0.25, 1.3, 2.6]) }],
              },
            ]} />
            <Animated.View style={[
              styles.initialSpark,
              {
                opacity: step([0, 0.11, 0.29, 0.49], [1, 1, 0.9, 0]),
                transform: [{ scale: step([0, 0.21, 0.49], [1, 1.1, 0.2]) }],
              },
            ]} />
            <Animated.View style={[
              styles.globe,
              {
                opacity: step([0.14, 0.38, 0.59, 0.78], [0, 0.86, 0.86, 0]),
                transform: [
                  { scale: step([0.14, 0.39, 0.6, 0.8], [0.12, 1, 1.25, 2.45]) },
                  { rotate: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["-12deg", "21deg"],
                  }) },
                ],
              },
            ]}>
              <View style={styles.globeEdge} />
              <View style={styles.globeEquator} />
              <View style={styles.latitudeTop} />
              <View style={styles.latitudeBottom} />
              <View style={styles.meridianLarge} />
              <View style={styles.meridianSmall} />
            </Animated.View>
            <Animated.View style={[
              styles.arrivalRipple,
              {
                opacity: step([0.52, 0.64, 0.83], [0, 0.9, 0]),
                transform: [{ scale: step([0.52, 0.7, 0.87], [0.2, 1, 2.15]) }],
              },
            ]}>
              <View style={styles.arrivalDot} />
            </Animated.View>
            <Animated.View style={[
              styles.orbitRing,
              {
                opacity: step([0.67, 0.85, 1], [0, 0.5, 0.36]),
                transform: [{ rotate: "-24deg" }, {
                  scale: step([0.68, 0.94, 1], [0.7, 1, 1]),
                }],
              },
            ]} />
          </>
        )}
        <Animated.View style={[
          styles.logo,
          {
            opacity: reduced ? 1 : step([0.71, 0.91, 1], [0, 1, 1]),
            transform: [{ scale: reduced ? 1 : step([0.71, 0.91, 1], [0.89, 1, 1]) }],
          },
        ]}>
          <BrandMark size={126} />
          <BrandWordmark width={204} />
        </Animated.View>
        {!reduced && (
          <Animated.View style={[
            styles.orbitSpark,
            {
              opacity: step([0.72, 0.79, 0.95, 1], [0, 1, 0.8, 0]),
              transform: [
                { translateX: step([0.7, 0.78, 0.85, 0.93, 1], [-143, -112, -16, 108, 43]) },
                { translateY: step([0.7, 0.78, 0.85, 0.93, 1], [14, -62, -74, -32, -43]) },
                { scale: step([0.75, 0.96, 1], [0.65, 1, 0.82]) },
              ],
            },
          ]} />
        )}
      </View>
      {!ready && settled && (
        <View style={styles.wait}>
          <LoadingDots color={colors.clay} />
          <Text style={styles.note}>Opening your neighbourhood…</Text>
        </View>
      )}
      {slow && !ready && (
        <View style={styles.recovery}>
          <Text style={styles.note}>Taking longer than usual. Check your connection.</Text>
          {onRetry && <Button title="Try again" variant="ghost" onPress={onRetry} />}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject, zIndex: 20,
    backgroundColor: colors.paper, alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  stage: { height: 366, width: 330, justifyContent: "center", alignItems: "center" },
  sparkHalo: {
    position: "absolute", width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#F4D7C4",
  },
  initialSpark: {
    position: "absolute", width: 19, height: 19, borderRadius: 10,
    backgroundColor: colors.clay,
  },
  globe: { position: "absolute", width: 224, height: 224, alignItems: "center", justifyContent: "center" },
  globeEdge: {
    position: "absolute", width: 223, height: 223, borderRadius: 112,
    borderColor: "#E2A789", borderWidth: 1.3,
  },
  globeEquator: {
    position: "absolute", width: 220, height: 72, borderRadius: 85,
    borderColor: "#DB9E7E", borderWidth: 1.1,
  },
  latitudeTop: {
    position: "absolute", top: 40, width: 192, height: 44, borderRadius: 100,
    borderColor: "#EBC7B3", borderWidth: 1.1,
  },
  latitudeBottom: {
    position: "absolute", bottom: 40, width: 192, height: 44, borderRadius: 100,
    borderColor: "#EBC7B3", borderWidth: 1.1,
  },
  meridianLarge: {
    position: "absolute", width: 111, height: 222, borderRadius: 65,
    borderColor: "#DFA987", borderWidth: 1.1, transform: [{ rotate: "17deg" }],
  },
  meridianSmall: {
    position: "absolute", width: 62, height: 222, borderRadius: 65,
    borderColor: "#ECCDB8", borderWidth: 1.1, transform: [{ rotate: "-14deg" }],
  },
  arrivalRipple: {
    position: "absolute", width: 83, height: 83, borderRadius: 45,
    borderColor: "#E7AC8C", borderWidth: 1.4,
    alignItems: "center", justifyContent: "center",
  },
  arrivalDot: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: colors.clay,
  },
  orbitRing: {
    position: "absolute", width: 315, height: 128, borderRadius: 160,
    borderWidth: 1.2, borderColor: "#D99D7F",
  },
  orbitSpark: {
    position: "absolute", width: 11, height: 11, borderRadius: 6,
    backgroundColor: "#E2733D",
    shadowColor: "#E2733D", shadowOpacity: 0.7, shadowRadius: 11, elevation: 2,
  },
  logo: { position: "absolute", alignItems: "center", gap: 11 },
  wait: {
    position: "absolute", top: "73%", alignItems: "center", gap: 12,
  },
  note: { ...typography.bodySmall, color: colors.textDim, textAlign: "center" },
  recovery: {
    position: "absolute", bottom: 32, left: 24, right: 24, alignItems: "center",
  },
});
