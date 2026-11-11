import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { colors, typography } from "../theme";
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
            style={[
              styles.choice,
              value === option.value && styles.selected,
              option.disabled && styles.disabled,
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

/** Draft changes are committed only by Show plans; dismiss/back discards them. */
export function PlanFilterSheet({
  value,
  hasLocation,
  demo,
  onApply,
  onClose,
  onChooseArea,
}: {
  value: PlanOptions;
  hasLocation: boolean;
  demo: boolean;
  onApply: (options: PlanOptions) => void;
  onClose: () => void;
  onChooseArea: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
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
          <View style={styles.sheet} accessibilityViewIsModal>
            <View style={styles.handle} accessible={false} />
            <View style={styles.header}>
              <Text accessibilityRole="header" style={styles.title}>
                Filter & sort
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close filters"
                onPress={onClose}
                style={styles.close}
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
                label="Category"
                value={draft.category}
                options={[
                  { value: null, label: "All categories" },
                  ...(["Play", "Meet", "Explore", "Unwind"] as const).map(
                    (value) => ({ value, label: value }),
                  ),
                ]}
                onChange={(category) => setDraft((d) => ({ ...d, category }))}
              />
              <Choices
                label="Distance"
                value={draft.maxDistanceKm}
                options={[
                  { value: null, label: "Default area" },
                  ...([2, 5, 10, 25] as const).map((value) => ({
                    value,
                    label: `Within ${value} km`,
                    disabled: !hasLocation,
                  })),
                ]}
                onChange={(maxDistanceKm) =>
                  setDraft((d) => ({ ...d, maxDistanceKm }))
                }
              />
              <Text style={styles.hint}>
                {demo
                  ? "Distances use sample data in demo mode."
                  : hasLocation
                    ? "Distances are measured from your selected location. Default area is within 5 km."
                    : "Choose an area or use your location to filter by distance and sort nearest first."}
              </Text>
              {!hasLocation && (
                <Button
                  title="Choose an area"
                  variant="secondary"
                  onPress={onChooseArea}
                  style={styles.areaButton}
                />
              )}
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
                onPress={() => setDraft({ ...DEFAULT_PLAN_OPTIONS })}
              />
              <Button
                title="Show plans"
                variant="solid"
                onPress={() => onApply(draft)}
                style={styles.apply}
              />
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.modalScrim },
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
  selectedText: { color: colors.forest, fontWeight: "600" },
  disabled: { opacity: 0.4 },
  hint: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: -10,
    marginBottom: 20,
  },
  areaButton: { marginTop: -8, marginBottom: 20 },
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
