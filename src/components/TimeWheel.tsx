import React, { useRef } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, typography } from "../theme";

const ROW_HEIGHT = 44;

/** A bounded wheel: each value snaps to the highlighted middle row. */
export function TimeWheel({
  label,
  values,
  value,
  onChange,
  compact = false,
}: {
  compact?: boolean;
  label: string;
  values: readonly number[];
  value: number;
  onChange: (value: number) => void;
}) {
  const wheelHeight = ROW_HEIGHT * (compact ? 3 : 5);
  const padding = (wheelHeight - ROW_HEIGHT) / 2;
  const scroll = useRef<ScrollView>(null);
  const initialIndex = useRef(Math.max(0, values.indexOf(value))).current;
  const selectedIndex = useRef(initialIndex);
  const select = (index: number) => {
    const next = Math.max(0, Math.min(values.length - 1, index));
    if (selectedIndex.current !== next) {
      selectedIndex.current = next;
      onChange(values[next]);
    }
    return next;
  };
  const moveTo = (index: number) => {
    scroll.current?.scrollTo({
      y: select(index) * ROW_HEIGHT,
      animated: false,
    });
  };
  return (
    <View style={styles.column}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[styles.wheel, { height: wheelHeight }]}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        aria-valuemin={values[0]}
        aria-valuemax={values[values.length - 1]}
        aria-valuenow={value}
        aria-valuetext={String(value).padStart(2, "0")}
        tabIndex={0}
        {...(Platform.OS === "web"
          ? {
              onKeyDown: (event: React.KeyboardEvent) => {
                const delta =
                  event.key === "ArrowUp"
                    ? 1
                    : event.key === "ArrowDown"
                      ? -1
                      : 0;
                if (delta) {
                  event.preventDefault();
                  moveTo(selectedIndex.current + delta);
                }
                if (event.key === "Home") {
                  event.preventDefault();
                  moveTo(0);
                }
                if (event.key === "End") {
                  event.preventDefault();
                  moveTo(values.length - 1);
                }
              },
            }
          : {})}
        accessibilityHint="Swipe up or down to change"
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (nativeEvent.actionName === "increment")
            moveTo(selectedIndex.current + 1);
          if (nativeEvent.actionName === "decrement")
            moveTo(selectedIndex.current - 1);
        }}
      >
        <View
          pointerEvents="none"
          style={[styles.selection, { top: padding }]}
        />
        <ScrollView
          ref={scroll}
          style={{
            height: wheelHeight,
            ...(Platform.OS === "web" ? { scrollSnapType: "y mandatory" } : {}),
          }}
          contentContainerStyle={{ paddingVertical: padding }}
          contentOffset={{ x: 0, y: initialIndex * ROW_HEIGHT }}
          onLayout={() =>
            scroll.current?.scrollTo({
              y: selectedIndex.current * ROW_HEIGHT,
              animated: false,
            })
          }
          snapToInterval={ROW_HEIGHT}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          nestedScrollEnabled
          scrollEventThrottle={16}
          onScroll={({ nativeEvent }) =>
            select(Math.round(nativeEvent.contentOffset.y / ROW_HEIGHT))
          }
          onMomentumScrollEnd={({ nativeEvent }) =>
            select(Math.round(nativeEvent.contentOffset.y / ROW_HEIGHT))
          }
        >
          {values.map((item, index) => (
            <Pressable
              key={item}
              accessible={false}
              tabIndex={-1}
              accessibilityRole="button"
              accessibilityLabel={`${label} ${String(item).padStart(2, "0")}`}
              onPress={() => moveTo(index)}
              style={{
                ...styles.row,
                ...(Platform.OS === "web" ? { scrollSnapAlign: "center" } : {}),
              }}
            >
              <Text
                maxFontSizeMultiplier={1.2}
                style={[styles.number, item === value && styles.selectedNumber]}
              >
                {String(item).padStart(2, "0")}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1, minWidth: 0 },
  label: {
    ...typography.label,
    color: colors.textDim,
    textAlign: "center",
    marginBottom: 8,
  },
  wheel: { overflow: "hidden" },
  selection: {
    position: "absolute",
    left: 0,
    right: 0,
    height: ROW_HEIGHT,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { height: ROW_HEIGHT, justifyContent: "center", alignItems: "center" },
  number: {
    ...typography.body,
    color: colors.textFaint,
    fontSize: 22,
    lineHeight: 36,
    fontVariant: ["tabular-nums"],
  },
  selectedNumber: {
    ...typography.title,
    fontSize: 28,
    lineHeight: 36,
    color: colors.text,
  },
});
