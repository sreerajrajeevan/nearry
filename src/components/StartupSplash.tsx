import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { colors } from "../theme/colors";
import { useReducedMotion } from "../store/MotionContext";

/**
 * Animated startup splash for the "n-pin" logo.
 * Sequence: the n draws itself (left stem up, arch curves over,
 * right stem down into the pin tip), the dot drops in, then the
 * "nearry" wordmark fades up underneath. After the animation the
 * finished mark holds statically until the parent unmounts it.
 *
 * Built with plain Animated Views only (no new dependencies).
 */

const STROKE = 26;
const ARCH_W = 112;
const ARCH_H = 56;
const LEFT_STEM_H = 110;
const RIGHT_STEM_H = 84;
const PIN_H = 20;
const DOT = 26;
const GAP = 10;

// Vertical layout inside the 140x210 logo box.
const RIGHT_X = ARCH_W - STROKE; // 86
const PIN_TOP = ARCH_H + RIGHT_STEM_H; // 140
const DOT_TOP = PIN_TOP + PIN_H + GAP; // 170
const LEFT_STEM_BOTTOM = 210 - (ARCH_H + LEFT_STEM_H); // 44

export function StartupSplash() {
  const reduced = useReducedMotion();

  const stemLeftH = useRef(new Animated.Value(0)).current;
  const archOpacity = useRef(new Animated.Value(0)).current;
  const archScale = useRef(new Animated.Value(0.8)).current;
  const stemRightH = useRef(new Animated.Value(0)).current;
  const pinScale = useRef(new Animated.Value(0)).current;
  const dotY = useRef(new Animated.Value(-18)).current;
  const dotScale = useRef(new Animated.Value(0)).current;
  const dotOpacity = useRef(new Animated.Value(0)).current;
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    if (reduced) {
      // Reduced motion: show the finished mark immediately.
      stemLeftH.setValue(LEFT_STEM_H);
      archOpacity.setValue(1);
      archScale.setValue(1);
      stemRightH.setValue(RIGHT_STEM_H);
      pinScale.setValue(1);
      dotY.setValue(0);
      dotScale.setValue(1);
      dotOpacity.setValue(1);
      wordOpacity.setValue(1);
      wordY.setValue(0);
      return;
    }
    const easeOut = Easing.out(Easing.cubic);
    Animated.parallel([
      // 1. Left stem draws upward.
      Animated.timing(stemLeftH, {
        toValue: LEFT_STEM_H,
        duration: 450,
        delay: 100,
        easing: easeOut,
        useNativeDriver: false,
      }),
      // 2. Arch curves over.
      Animated.sequence([
        Animated.delay(350),
        Animated.parallel([
          Animated.timing(archOpacity, {
            toValue: 1,
            duration: 350,
            easing: easeOut,
            useNativeDriver: true,
          }),
          Animated.timing(archScale, {
            toValue: 1,
            duration: 400,
            easing: easeOut,
            useNativeDriver: true,
          }),
        ]),
      ]),
      // 3. Right stem draws downward.
      Animated.timing(stemRightH, {
        toValue: RIGHT_STEM_H,
        duration: 350,
        delay: 650,
        easing: easeOut,
        useNativeDriver: false,
      }),
      // 4. Pin tip pops in.
      Animated.timing(pinScale, {
        toValue: 1,
        duration: 250,
        delay: 950,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: true,
      }),
      // 5. Dot drops in and settles.
      Animated.sequence([
        Animated.delay(1100),
        Animated.parallel([
          Animated.spring(dotY, {
            toValue: 0,
            friction: 7,
            tension: 90,
            useNativeDriver: true,
          }),
          Animated.spring(dotScale, {
            toValue: 1,
            friction: 7,
            tension: 90,
            useNativeDriver: true,
          }),
          Animated.timing(dotOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
      ]),
      // 6. Wordmark fades up.
      Animated.sequence([
        Animated.delay(1400),
        Animated.parallel([
          Animated.timing(wordOpacity, {
            toValue: 1,
            duration: 450,
            easing: easeOut,
            useNativeDriver: true,
          }),
          Animated.timing(wordY, {
            toValue: 0,
            duration: 450,
            easing: easeOut,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, [
    reduced,
    stemLeftH,
    archOpacity,
    archScale,
    stemRightH,
    pinScale,
    dotY,
    dotScale,
    dotOpacity,
    wordOpacity,
    wordY,
  ]);

  return (
    <View style={styles.screen}>
      <View style={styles.logoBox}>
        {/* Arch */}
        <Animated.View
          style={[
            styles.arch,
            { opacity: archOpacity, transform: [{ scale: archScale }] },
          ]}
        />
        {/* Left stem (grows upward) */}
        <Animated.View
          style={[styles.stem, styles.stemLeft, { height: stemLeftH }]}
        />
        {/* Right stem (grows downward) */}
        <Animated.View
          style={[styles.stem, styles.stemRight, { height: stemRightH }]}
        />
        {/* Pin tip */}
        <Animated.View
          style={[styles.pinTip, { transform: [{ scale: pinScale }] }]}
        />
        {/* Dot */}
        <Animated.View
          style={[
            styles.dot,
            {
              opacity: dotOpacity,
              transform: [{ translateY: dotY }, { scale: dotScale }],
            },
          ]}
        />
      </View>
      <Animated.Text
        style={[
          styles.wordmark,
          {
            opacity: wordOpacity,
            transform: [{ translateY: wordY }],
          },
        ]}
      >
        nearry
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  logoBox: {
    width: 140,
    height: 210,
  },
  arch: {
    position: "absolute",
    left: 0,
    top: 0,
    width: ARCH_W,
    height: ARCH_H,
    borderWidth: STROKE,
    borderColor: colors.clay,
    borderBottomWidth: 0,
    borderTopLeftRadius: ARCH_W / 2,
    borderTopRightRadius: ARCH_W / 2,
  },
  stem: {
    position: "absolute",
    width: STROKE,
    borderRadius: STROKE / 2,
    backgroundColor: colors.clay,
  },
  stemLeft: {
    left: 0,
    bottom: LEFT_STEM_BOTTOM,
  },
  stemRight: {
    left: RIGHT_X,
    top: ARCH_H,
  },
  pinTip: {
    position: "absolute",
    left: RIGHT_X,
    top: PIN_TOP,
    width: 0,
    height: 0,
    borderLeftWidth: STROKE / 2,
    borderRightWidth: STROKE / 2,
    borderTopWidth: PIN_H,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: colors.clay,
  },
  dot: {
    position: "absolute",
    left: RIGHT_X,
    top: DOT_TOP,
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: colors.clay,
  },
  wordmark: {
    marginTop: 28,
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.ink,
  },
});
