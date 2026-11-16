import React, { useRef } from "react";
import {
  Animated,
  GestureResponderHandlers,
  PanResponder,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { colors } from "../theme";

const native = Platform.OS !== "web";

/**
 * Drag a sheet down to close it. The sheet follows the finger; let go past
 * a short distance (or with a quick flick) and it closes, otherwise it
 * springs back. Only downward drags count, so taps and scrolling still work.
 */
export function useSheetDrag(onClose: () => void) {
  const y = useRef(new Animated.Value(0)).current;
  const close = useRef(onClose);
  close.current = onClose;
  const back = () =>
    Animated.spring(y, {
      toValue: 0,
      speed: 28,
      bounciness: 4,
      useNativeDriver: native,
    }).start();
  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => y.setValue(Math.max(0, g.dy)),
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, g) => {
        if (g.dy > 110 || g.vy > 0.9)
          Animated.timing(y, {
            toValue: 700,
            duration: 160,
            useNativeDriver: native,
          }).start(() => {
            close.current();
            y.setValue(0);
          });
        else back();
      },
      onPanResponderTerminate: back,
    }),
  ).current;
  return {
    handlers: responder.panHandlers,
    style: { transform: [{ translateY: y }] },
  };
}

/** The grab bar, in a touch area wide and tall enough to drag. */
export function SheetGrabber({
  handlers,
}: {
  handlers: GestureResponderHandlers;
}) {
  return (
    <View
      {...handlers}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={styles.zone}
    >
      <View style={styles.bar} />
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {
    alignSelf: "stretch",
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  bar: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
  },
});
