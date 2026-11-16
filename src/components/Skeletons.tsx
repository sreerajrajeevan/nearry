import React, { createContext, useContext, useEffect, useRef } from "react";
import {
  Animated,
  DimensionValue,
  Easing,
  Platform,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { useMotionActive } from "../hooks/useMotionActive";
import { colors } from "../theme";

/**
 * Grey shapes in the layout of the content that's coming, so a screen never
 * looks empty while it loads. One gentle pulse is shared by every shape; with
 * reduced motion the shapes stay still.
 */
const Pulse = createContext<Animated.AnimatedInterpolation<number> | number>(1);

function Placeholder({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const active = useMotionActive();
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    value.setValue(0);
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence(
        [1, 0].map((toValue) =>
          Animated.timing(value, {
            toValue,
            duration: 800,
            easing: Easing.inOut(Easing.quad),
            isInteraction: false,
            useNativeDriver: Platform.OS !== "web",
          }),
        ),
      ),
    );
    loop.start();
    return () => loop.stop();
  }, [active, value]);
  const opacity = active
    ? value.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] })
    : 1;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
    >
      <Pulse.Provider value={opacity}>{children}</Pulse.Provider>
    </View>
  );
}

function Bone({
  w = "100%",
  h,
  r = 8,
  style,
}: {
  w?: DimensionValue;
  h: number;
  r?: number;
  style?: ViewStyle;
}) {
  const opacity = useContext(Pulse);
  return (
    <Animated.View
      style={[
        styles.bone,
        { width: w, height: h, borderRadius: r, opacity },
        style,
      ]}
    />
  );
}

/** Shaped like a plan card on Home. */
function PlanCardShape() {
  return (
    <View style={styles.card}>
      <Bone h={150} r={18} />
      <View style={styles.cardBody}>
        <Bone w="72%" h={16} />
        <Bone w="48%" h={11} style={{ marginTop: 10 }} />
        <View style={styles.cardFoot}>
          <Bone w={90} h={11} />
          <Bone w={84} h={40} r={20} />
        </View>
      </View>
    </View>
  );
}

export function PlanListSkeleton({
  label = "Loading plans",
  count = 2,
}: {
  label?: string;
  count?: number;
}) {
  return (
    <Placeholder label={label}>
      {Array.from({ length: count }, (_, i) => (
        <PlanCardShape key={i} />
      ))}
    </Placeholder>
  );
}

/** Shaped like the plan page: photo, title, the 2×2 info grid, host. */
export function PlanDetailsSkeleton() {
  return (
    <Placeholder label="Loading this plan">
      <Bone h={280} r={0} />
      <View style={styles.detailBody}>
        <Bone w={90} h={11} />
        <Bone w="80%" h={24} style={{ marginTop: 12 }} />
        <View style={styles.grid}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.tile}>
              <Bone w={22} h={22} r={11} />
              <Bone w="45%" h={10} style={{ marginTop: 12 }} />
              <Bone w="75%" h={14} style={{ marginTop: 8 }} />
            </View>
          ))}
        </View>
        <View style={styles.row}>
          <Bone w={46} h={46} r={23} />
          <View style={styles.flex}>
            <Bone w="40%" h={10} />
            <Bone w="60%" h={14} style={{ marginTop: 8 }} />
          </View>
        </View>
      </View>
    </Placeholder>
  );
}

/** Shaped like a list of chats or activity: avatar, two lines. */
export function RowListSkeleton({
  label,
  count = 5,
  square = false,
}: {
  label: string;
  count?: number;
  square?: boolean;
}) {
  return (
    <Placeholder label={label}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.row, styles.listRow]}>
          <Bone w={52} h={52} r={square ? 16 : 26} />
          <View style={styles.flex}>
            <Bone w={i % 2 ? "55%" : "70%"} h={14} />
            <Bone w={i % 2 ? "80%" : "62%"} h={11} style={{ marginTop: 9 }} />
          </View>
        </View>
      ))}
    </Placeholder>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  bone: { backgroundColor: colors.surfaceRaised },
  card: {
    marginBottom: 16,
    padding: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardBody: { paddingHorizontal: 6, paddingTop: 14, paddingBottom: 4 },
  cardFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
  detailBody: { paddingHorizontal: 20, paddingTop: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 20 },
  tile: {
    flexBasis: "47%",
    flexGrow: 1,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 20,
  },
  listRow: {
    marginTop: 0,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
