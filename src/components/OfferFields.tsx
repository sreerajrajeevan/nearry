import React from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { colors, typography, weight } from "../theme";
import { Icon } from "./Icon";

export const SLOT_MINUTES = [30, 45, 60, 90, 120] as const;
const MAX_PLACES = 500;

/** A titled card that groups related offer fields. */
export function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {!!hint && <Text style={styles.sectionHint}>{hint}</Text>}
      {children}
    </View>
  );
}

/** How many people one slot takes, and how long a slot lasts. */
export function SlotFields({
  capacity,
  onCapacity,
  minutes,
  onMinutes,
}: {
  capacity: string;
  onCapacity: (value: string) => void;
  minutes: string;
  onMinutes: (value: string) => void;
}) {
  const places = Math.max(1, Number(capacity) || 1);
  const step = (delta: number) =>
    onCapacity(String(Math.min(MAX_PLACES, Math.max(1, places + delta))));
  return (
    <View style={styles.slots}>
      <View style={styles.stepperRow}>
        <View style={styles.flex}>
          <Text style={styles.label}>People per slot</Text>
          <Text style={styles.hint}>How many can book the same time</Text>
        </View>
        <View style={styles.stepper}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fewer people per slot"
            disabled={places <= 1}
            onPress={() => step(-1)}
            style={({ pressed }) => [
              styles.stepButton,
              places <= 1 && styles.disabled,
              pressed && pressedStyle,
            ]}
          >
            <Icon name="minus" size={18} color={colors.ink} />
          </Pressable>
          <Text
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${places} per slot`}
            style={styles.stepValue}
          >
            {places}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More people per slot"
            disabled={places >= MAX_PLACES}
            onPress={() => step(1)}
            style={({ pressed }) => [
              styles.stepButton,
              places >= MAX_PLACES && styles.disabled,
              pressed && pressedStyle,
            ]}
          >
            <Icon name="plus" size={18} color={colors.ink} />
          </Pressable>
        </View>
      </View>
      <Text style={[styles.label, styles.gap]}>Each slot lasts</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Slot length"
        style={styles.chips}
      >
        {SLOT_MINUTES.map((value) => {
          const on = Number(minutes) === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              aria-checked={on}
              accessibilityLabel={`${value} minutes`}
              onPress={() => onMinutes(String(value))}
              style={({ pressed }) => [
                styles.chip,
                on && styles.chipOn,
                pressed && pressedStyle,
              ]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {value < 60 ? `${value} min` : `${value / 60} hr`}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Spotlight puts the offer in the Home carousel. */
export function SpotlightToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.spotlight}>
      <View style={styles.spotIcon}>
        <Icon name="star" size={18} color={colors.night} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.label}>Spotlight on Home</Text>
        <Text style={styles.hint}>Show it in the offers carousel</Text>
      </View>
      <Switch
        accessibilityLabel="Spotlight on Home"
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.amber, false: colors.border }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

/** Shown the moment a finger lands on a control. */
const pressedStyle = { opacity: 0.6 };
const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.ink,
    ...weight("800"),
    marginBottom: 4,
  },
  sectionHint: {
    ...typography.caption,
    color: colors.textDim,
    marginBottom: 8,
  },
  slots: { gap: 4 },
  label: { ...typography.body, color: colors.ink, ...weight("700") },
  hint: { ...typography.caption, color: colors.textDim, marginTop: 1 },
  gap: { marginTop: 14, marginBottom: 6 },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
  },
  disabled: { opacity: 0.35 },
  stepValue: {
    minWidth: 32,
    textAlign: "center",
    ...typography.title,
    color: colors.ink,
    ...weight("800"),
  },
  chips: { flexDirection: "row", gap: 6 },
  chip: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipOn: { backgroundColor: colors.night, borderColor: colors.night },
  chipText: { ...typography.caption, color: colors.gray800, ...weight("700") },
  chipTextOn: { color: "#FFFFFF" },
  spotlight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.amberSoft,
  },
  spotIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberBright,
  },
});
