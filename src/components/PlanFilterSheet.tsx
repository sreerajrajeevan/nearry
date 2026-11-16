import { SheetGrabber, useSheetDrag } from "./SheetDrag";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Animated,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { colors, typography, weight } from "../theme";
import { useReducedMotion } from "../store/MotionContext";
import {
  DEFAULT_PLAN_OPTIONS,
  PLAN_AUDIENCE_LABELS,
  PLAN_SORT_LABELS,
  PlanAudience,
  PlanOptions,
  PlanSort,
} from "../utils/planDiscovery";
import { Button } from "./Button";
import { Icon } from "./Icon";

function Choices<T extends string | number | null>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.group}>
      <Text accessibilityRole="header" style={styles.label}>
        {label}
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        style={styles.choices}
      >
        {options.map((option) => (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{
              checked: value === option.value,
              disabled: !!option.disabled,
            }}
            aria-checked={value === option.value}
            disabled={option.disabled}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.choice,
              value === option.value && styles.selected,
              option.disabled && styles.disabled,
              ,
              pressed && pressedStyle,
            ]}
          >
            <Text
              style={[
                styles.choiceText,
                value === option.value && styles.selectedText,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const countLabel = (count: number) =>
  count === 0
    ? "No plans match"
    : `Show ${count} plan${count === 1 ? "" : "s"}`;

/**
 * Sort, cost and audience only: category sits on Home's rail and distance in
 * the location sheet. Draft changes are committed only by the Show button.
 */
export function PlanFilterSheet({
  value,
  hasLocation,
  countFor,
  onApply,
  onClose,
}: {
  value: PlanOptions;
  hasLocation: boolean;
  /** How many plans Home would show with these options. */
  countFor: (options: PlanOptions) => number;
  onApply: (options: PlanOptions) => void;
  onClose: () => void;
}) {
  const drag = useSheetDrag(onClose);
  const [draft, setDraft] = useState(value);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const count = countFor(draft);
  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      presentationStyle="overFullScreen"
      animationType={reduced ? "none" : "slide"}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Dismiss filters"
          onPress={onClose}
        />
        <SafeAreaView edges={["top", "left", "right"]} style={styles.position}>
          <Animated.View
            style={[styles.sheet, drag.style, drag.style]}
            accessibilityViewIsModal
          >
            <SheetGrabber handlers={drag.handlers} />
            <View {...drag.handlers} style={styles.header}>
              <Text accessibilityRole="header" style={styles.title}>
                Filter & sort
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close filters"
                onPress={onClose}
                style={({ pressed }) => [styles.close, pressed && pressedStyle]}
              >
                <Icon name="x" size={22} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.scroller}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              <Choices<PlanSort>
                label="Sort by"
                value={draft.sort}
                options={(["soonest", "nearest", "newest"] as const).map(
                  (value) => ({
                    value,
                    label: PLAN_SORT_LABELS[value],
                    disabled: value === "nearest" && !hasLocation,
                  }),
                )}
                onChange={(sort) => setDraft((d) => ({ ...d, sort }))}
              />
              <Choices
                label="Cost"
                value={draft.freeOnly ? "free" : "all"}
                options={[
                  { value: "all", label: "Any price" },
                  { value: "free", label: "Free only" },
                ]}
                onChange={(cost) =>
                  setDraft((d) => ({ ...d, freeOnly: cost === "free" }))
                }
              />
              <Choices<PlanAudience>
                label="Who can join"
                value={draft.audience}
                options={(["all", "any", "female", "male"] as const).map(
                  (value) => ({ value, label: PLAN_AUDIENCE_LABELS[value] }),
                )}
                onChange={(audience) => setDraft((d) => ({ ...d, audience }))}
              />
              <Text style={styles.hint}>
                Shows the host’s audience preference. Joining rules still apply.
              </Text>
            </ScrollView>
            <View
              style={[
                styles.footer,
                { paddingBottom: Math.max(insets.bottom, 12) },
              ]}
            >
              <Button
                title="Reset"
                variant="ghost"
                onPress={() =>
                  setDraft((d) => ({
                    ...DEFAULT_PLAN_OPTIONS,
                    category: d.category,
                    maxDistanceKm: d.maxDistanceKm,
                  }))
                }
              />
              <Button
                title={countLabel(count)}
                variant="solid"
                onPress={() => onApply(draft)}
                style={styles.apply}
              />
            </View>
          </Animated.View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/** Shown the moment a finger lands on a control. */
const pressedStyle = { opacity: 0.6 };
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(8,37,27,0.38)" },
  position: { flex: 1, justifyContent: "flex-end", paddingTop: 20 },
  sheet: {
    maxHeight: "94%",
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: "center",
    marginTop: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: 20,
    paddingRight: 12,
    paddingVertical: 8,
  },
  title: { ...typography.title, color: colors.forest, flex: 1 },
  close: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  scroller: { flexShrink: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  group: { marginBottom: 20 },
  label: { ...typography.heading, color: colors.text, marginBottom: 8 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    minHeight: 44,
    maxWidth: "100%",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    justifyContent: "center",
  },
  choiceText: { ...typography.bodySmall, color: colors.textDim, flexShrink: 1 },
  selected: { backgroundColor: colors.sageSoft, borderColor: colors.forest },
  selectedText: { color: colors.forest, ...weight("600") },
  disabled: { opacity: 0.4 },
  hint: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: -10,
    marginBottom: 20,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  apply: { flex: 1 },
});
