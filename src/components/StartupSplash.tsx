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
import { LoadingDots } from "./LoadingDots";
import { Button } from "./Button";
import { useMotionPreference } from "../store/MotionContext";
import { colors, typography } from "../theme";

/**
 * Nearry's opening story: nearby spark -> abstract, borderless globe ->
 * closer orbital paths -> the APPROVED Around You pin + wordmark.
 * No actual countries, map imagery, location lookup, or new logo artwork.
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
  const { ready: motionReady, reduced } = useMotionPreference();
  const [settled, setSettled] = useState(false);
  const [slow, setSlow] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const finish = useRef(onFinish);
  finish.current = onFinish;
  const nativeDriver = Platform.OS !== "web";
  const frame = (inputRange: number[], outputRange: number[]) =>
    progress.interpolate({ inputRange, outputRange, extrapolate: "clamp" });

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!active || !motionReady) return;
    if (reduced) {
      progress.setValue(1);
      setSettled(true);
      return;
    }
    setSettled(false);
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 1840,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: nativeDriver,
    });
    animation.start(({ finished }) => {
      if (finished) setSettled(true);
    });
    return () => animation.stop();
  }, [active, motionReady, reduced, progress, nativeDriver]);

  useEffect(() => {
    if (!ready || !settled) return;
    if (reduced) {
      finish.current?.();
      return;
    }
    const animation = Animated.timing(fade, {
      toValue: 0,
      duration: 230,
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
      accessibilityLabel="Opening Nearry"
      accessibilityState={{ busy: !ready }}
    >
      <View style={styles.story} accessible={false} pointerEvents="none">
        {!reduced && (
          <>
            <Animated.View
              style={[
                styles.sparkHalo,
                {
                  opacity: frame([0, 0.1, 0.29, 0.44], [0, 0.5, 0.35, 0]),
                  transform: [{ scale: frame([0, 0.24, 0.5], [0.3, 1.5, 2]) }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.spark,
                {
                  opacity: frame([0, 0.1, 0.24, 0.42], [0, 1, 1, 0]),
                  transform: [{ scale: frame([0, 0.22, 0.42], [0.4, 1, 0.3]) }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.globe,
                {
                  opacity: frame([0.13, 0.34, 0.59, 0.79], [0, 1, 1, 0]),
                  transform: [
                    { scale: frame([0.1, 0.38, 0.64, 0.82], [0.22, 1, 1.17, 2.9]) },
                    { rotate: frame([0, 0.82], [0, 14]).interpolate({inputRange:[0,14],outputRange:["0deg","14deg"]}) },
                  ],
                },
              ]}
            >
              <View style={styles.sphereOutline} />
              <View style={styles.equator} />
              <View style={styles.latitudeUpper} />
              <View style={styles.latitudeLower} />
              <View style={styles.meridianWide} />
              <View style={styles.meridianThin} />
              <View style={styles.orbit} />
              <View style={styles.orbitDot} />
            </Animated.View>
            <Animated.View
              style={[
                styles.destination,
                {
                  opacity: frame([0.49, 0.64, 0.79, 0.87], [0, 0.9, 0.6, 0]),
                  transform: [{ scale: frame([0.48, 0.7, 0.87], [0.1, 1.1, 1.8]) }],
                },
              ]}
            >
              <View style={styles.destinationCore} />
            </Animated.View>
          </>
        )}
        <Animated.View
          style={[
            styles.identity,
            {
              opacity: reduced ? 1 : frame([0.69, 0.85, 1], [0, 1, 1]),
              transform: [
                { scale: reduced ? 1 : frame([0.7, 0.9, 1], [0.87, 1, 1]) },
              ],
            },
          ]}
        >
          <BrandMark size={112} />
          <BrandWordmark width={184} />
        </Animated.View>
      </View>
      {!ready && settled && (
        <View style={styles.wait}>
          <LoadingDots />
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

const GLOBE = 230;
const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  story: { height: 340, width: 300, justifyContent: "center", alignItems: "center" },
  spark: {
    position: "absolute", width: 19, height: 19, borderRadius: 10,
    backgroundColor: colors.clay,
  },
  sparkHalo: {
    position: "absolute", width: 70, height: 70, borderRadius: 35,
    backgroundColor: colors.claySoft,
  },
  globe: {
    position: "absolute", height: GLOBE, width: GLOBE,
    alignItems: "center", justifyContent: "center",
  },
  sphereOutline: {
    position: "absolute", width: GLOBE, height: GLOBE, borderRadius: GLOBE / 2,
    borderWidth: 1.6, borderColor: colors.clay,
  },
  equator: {
    position: "absolute", width: 222, height: 71, borderRadius: 100,
    borderWidth: 1.4, borderColor: colors.clay,
  },
  latitudeUpper: {
    position: "absolute", top: 44, width: 193, height: 39, borderRadius: 100,
    borderWidth: 1.2, borderColor: colors.lineStrong,
  },
  latitudeLower: {
    position: "absolute", bottom: 44, width: 193, height: 39, borderRadius: 100,
    borderWidth: 1.2, borderColor: colors.lineStrong,
  },
  meridianWide: {
    position: "absolute", height: 228, width: 112, borderRadius: 80,
    borderWidth: 1.2, borderColor: colors.clay, transform: [{ rotate: "18deg" }],
  },
  meridianThin: {
    position: "absolute", height: 228, width: 56, borderRadius: 50,
    borderWidth: 1, borderColor: colors.lineStrong, transform: [{ rotate: "-20deg" }],
  },
  orbit: {
    position: "absolute", width: 269, height: 104, borderRadius: 100,
    borderWidth: 1.2, borderColor: colors.clay,
    transform: [{ rotate: "-30deg" }],
  },
  orbitDot: {
    position: "absolute", top: 52, right: 11, width: 10, height: 10,
    borderRadius: 5, backgroundColor: colors.clay,
  },
  destination: {
    position: "absolute", width: 94, height: 94,
    borderRadius: 47, borderWidth: 1.5, borderColor: colors.clay,
    alignItems: "center", justifyContent: "center",
  },
  destinationCore: {
    width: 19, height: 19, borderRadius: 10, backgroundColor: colors.clay,
  },
  identity: {
    position: "absolute", alignItems: "center", gap: 8,
  },
  wait: { position: "absolute", top: "70%", alignItems: "center", gap: 12 },
  note: { ...typography.bodySmall, textAlign: "center", color: colors.textDim },
  recovery: {
    position: "absolute", bottom: 32, left: 24, right: 24,
    alignItems: "center",
  },
});
