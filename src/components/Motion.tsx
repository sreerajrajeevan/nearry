import React, { useContext, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from "react-native";
import { NavigationContext } from "@react-navigation/native";
import { useReducedMotion } from "../store/MotionContext";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
type PressProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
};

/** Tactile feedback without animating layout or delaying the action. */
export function MotionPressable({
  style,
  onPressIn,
  onPressOut,
  ...props
}: PressProps) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced) {
      scale.stopAnimation();
      scale.setValue(1);
    }
    return () => scale.stopAnimation();
  }, [reduced, scale]);
  const animate = (toValue: number) => {
    scale.stopAnimation();
    if (reduced) scale.setValue(1);
    else
      Animated.spring(scale, {
        toValue,
        speed: 35,
        bounciness: 2,
        useNativeDriver: Platform.OS !== "web",
      }).start();
  };
  return (
    <AnimatedPressable
      {...props}
      style={[style, { transform: [{ scale }] }]}
      onPressIn={(event) => {
        animate(0.97);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animate(1);
        onPressOut?.(event);
      }}
    />
  );
}

/** A short focus transition; all content remains available with reduced motion. */
export function ScreenReveal({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(1)).current;
  const navigation = useContext(NavigationContext);
  useEffect(() => {
    const enter = () => {
      progress.stopAnimation();
      if (reduced) progress.setValue(1);
      else {
        progress.setValue(0);
        Animated.timing(progress, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== "web",
        }).start();
      }
    };
    enter();
    const stop = navigation?.addListener("focus", enter);
    return () => {
      stop?.();
      progress.stopAnimation();
      progress.setValue(1);
    };
  }, [navigation, progress, reduced]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.55, 1],
          }),
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
