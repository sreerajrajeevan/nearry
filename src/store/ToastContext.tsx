import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, IconName } from "../components/Icon";
import { useReducedMotion } from "./MotionContext";
import { colors, weight } from "../theme";

type Toast = { id: number; text: string; icon: IconName };
const Context = createContext<(text: string, icon?: IconName) => void>(
  () => {},
);

/** A short confirmation that slides down at the top, then leaves. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const counter = useRef(0);
  const show = useCallback((text: string, icon: IconName = "check") => {
    AccessibilityInfo.announceForAccessibility(text);
    setToast({ id: ++counter.current, text, icon });
  }, []);
  return (
    <Context.Provider value={show}>
      {children}
      {toast && (
        <ToastView
          key={toast.id}
          toast={toast}
          onDone={() =>
            setToast((current) => (current?.id === toast.id ? null : current))
          }
        />
      )}
    </Context.Provider>
  );
}

function ToastView({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    const native = Platform.OS !== "web";
    const enter = reduced
      ? Animated.delay(0)
      : Animated.spring(progress, {
          toValue: 1,
          speed: 16,
          bounciness: 6,
          useNativeDriver: native,
        });
    const leave = reduced
      ? Animated.delay(0)
      : Animated.timing(progress, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: native,
        });
    const sequence = Animated.sequence([enter, Animated.delay(2400), leave]);
    sequence.start(({ finished }) => finished && onDone());
    return () => sequence.stop();
  }, [progress, reduced, onDone]);
  return (
    <View
      pointerEvents="none"
      style={[styles.layer, { top: Math.max(insets.top, 12) + 8 }]}
    >
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          styles.toast,
          {
            opacity: progress,
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-24, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.icon}>
          <Icon name={toast.icon} size={14} color={colors.onAmber} />
        </View>
        <Text style={styles.text} numberOfLines={2}>
          {toast.text}
        </Text>
      </Animated.View>
    </View>
  );
}

export const useToast = () => useContext(Context);

const styles = StyleSheet.create({
  layer: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    maxWidth: 420,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 18,
    borderRadius: 18,
    backgroundColor: colors.night,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  icon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberBright,
  },
  text: { color: "#FFFFFF", fontSize: 14, lineHeight: 19, ...weight("700") },
});
