import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BRAND_ASSETS, BrandWordmark } from "./BrandLogo";
import { LoadingDots } from "./LoadingDots";
import { Button } from "./Button";
import { useMotionPreference } from "../store/MotionContext";
import { colors, typography } from "../theme";

/** One launch only: the nearby point settles beside the pin, then reveals the ready app. */
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
  const preference = useMotionPreference();
  const [settled, setSettled] = useState(false);
  const [slow, setSlow] = useState(false);
  const arrive = useRef(new Animated.Value(1)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const finish = useRef(onFinish);
  finish.current = onFinish;
  const native = Platform.OS !== "web";
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!active || !preference.ready) return;
    if (preference.reduced) {
      arrive.setValue(1);
      setSettled(true);
      return;
    }
    arrive.setValue(0);
    const animation = Animated.timing(arrive, {
      toValue: 1,
      duration: 620,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: native,
    });
    animation.start(({ finished }) => {
      if (finished) setSettled(true);
    });
    return () => {
      animation.stop();
      arrive.stopAnimation();
    };
  }, [active, preference.ready, preference.reduced, arrive, native]);
  useEffect(() => {
    if (!ready || !settled) return;
    if (preference.reduced) {
      finish.current?.();
      return;
    }
    const animation = Animated.timing(fade, {
      toValue: 0,
      duration: 180,
      useNativeDriver: native,
    });
    animation.start(({ finished }) => {
      if (finished) finish.current?.();
    });
    return () => {
      animation.stop();
      fade.stopAnimation();
    };
  }, [ready, settled, preference.reduced, fade, native]);
  return (
    <Animated.View
      style={[styles.screen, { opacity: fade }]}
      accessibilityRole="progressbar"
      accessibilityState={{ busy: !ready }}
      accessibilityLabel="Opening Nearry"
    >
      <View style={styles.identity} accessible={false}>
        <View style={styles.symbol}>
          <Animated.Image
            source={BRAND_ASSETS[0]}
            fadeDuration={0}
            style={[
              styles.pin,
              {
                opacity: arrive.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.85, 1],
                }),
                transform: [
                  {
                    scale: arrive.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, 1],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                transform: [
                  {
                    translateY: arrive.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-12, 0],
                    }),
                  },
                  {
                    scale: arrive.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.65, 1],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
        <Animated.View
          style={{
            opacity: arrive.interpolate({
              inputRange: [0, 1],
              outputRange: [0.7, 1],
            }),
          }}
        >
          <BrandWordmark width={164} />
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
          <Text style={styles.note}>
            Taking longer than usual. Check your connection.
          </Text>
          {onRetry && (
            <Button title="Try again" variant="ghost" onPress={onRetry} />
          )}
        </View>
      )}
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  identity: { alignItems: "center", gap: 16 },
  symbol: { width: 112, height: 112 },
  pin: { width: 112, height: 112 },
  dot: {
    position: "absolute",
    left: (112 * 198) / 256,
    top: (112 * 96) / 256,
    width: (112 * 36) / 256,
    height: (112 * 36) / 256,
    borderRadius: 20,
    backgroundColor: colors.clay,
  },
  wait: { position: "absolute", top: "67%", alignItems: "center", gap: 12 },
  note: { ...typography.bodySmall, textAlign: "center", color: colors.textDim },
  recovery: {
    position: "absolute",
    bottom: 32,
    left: 24,
    right: 24,
    alignItems: "center",
  },
});
