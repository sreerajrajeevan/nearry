import React, { useEffect, useRef } from "react";
import { Animated, Easing, Platform, View } from "react-native";
import { colors } from "../theme";
import { useMotionActive } from "../hooks/useMotionActive";

/** Quiet, shared action feedback; the button keeps its readable label. */
export function LoadingDots({
  color = colors.clay,
  size = 5,
}: {
  color?: string;
  size?: number;
}) {
  const active = useMotionActive();
  const phase = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    phase.setValue(0);
    if (!active) return;
    const animation = Animated.loop(
      Animated.timing(phase, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        isInteraction: false,
        useNativeDriver: Platform.OS !== "web",
      }),
    );
    animation.start();
    return () => {
      animation.stop();
      phase.stopAnimation();
      phase.setValue(0);
    };
  }, [active, phase]);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: size * 0.7,
        height: size * 2,
      }}
      accessible={false}
    >
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size,
            backgroundColor: color,
            opacity: active
              ? phase.interpolate({
                  inputRange: [0, 0.2 + i * 0.14, 0.36 + i * 0.14, 1],
                  outputRange: [0.4, 1, 0.4, 0.4],
                })
              : 1,
          }}
        />
      ))}
    </View>
  );
}
