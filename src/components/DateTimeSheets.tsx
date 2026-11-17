import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, typography, spacing } from "../theme";
import { TimeWheel } from "./TimeWheel";
import { clockParts, withClockTime } from "../utils/timePicker";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function Sheet({
  visible,
  title,
  onClose,
  children,
  onDone,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  onDone?: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView style={styles.backdrop} behavior="padding">
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Close picker"
          onPress={onClose}
        />
        <SafeAreaView
          edges={["bottom", "left", "right"]}
          style={[styles.sheet, !!onDone && styles.timeSheet]}
          accessibilityViewIsModal
        >
          <View style={[styles.sheetHead, !!onDone && styles.timeSheetHead]}>
            {!!onDone && (
              <Pressable
                accessibilityRole="button"
                onPress={onClose}
                style={styles.doneTouch}
              >
                <Text style={styles.cancelBtn}>Cancel</Text>
              </Pressable>
            )}
            <Text
              style={[styles.sheetTitle, !!onDone && styles.timeSheetTitle]}
            >
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done"
              onPress={onDone ?? onClose}
              style={({ pressed }) => [
                styles.doneTouch,
                !!onDone && styles.timeDoneTouch,
                pressed && pressedStyle,
              ]}
            >
              <Text style={[styles.doneBtn, !!onDone && styles.timeDoneText]}>
                Done
              </Text>
            </Pressable>
          </View>
          {onDone ? (
            children
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Calendar bottom sheet. Past days are disabled. */
export function DateSheet({
  visible,
  value,
  onPick,
  onClose,
}: {
  visible: boolean;
  value: Date | null;
  onPick: (d: Date) => void;
  onClose: () => void;
}) {
  const today = startOfDay(new Date());
  const [cursor, setCursor] = useState(() => startOfDay(value ?? new Date()));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) => new Date(year, month, i + 1),
    ),
  ];
  const selectedDay = value ? startOfDay(value).getTime() : null;

  return (
    <Sheet visible={visible} title="Pick a date" onClose={onClose}>
      <View style={styles.monthRow}>
        <TouchableOpacity
          onPress={() => setCursor((c) => addMonths(c, -1))}
          hitSlop={12}
        >
          <Text style={styles.monthNav}>{"<"}</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>
          {MONTHS[month]} {year}
        </Text>
        <TouchableOpacity
          onPress={() => setCursor((c) => addMonths(c, 1))}
          hitSlop={12}
        >
          <Text style={styles.monthNav}>{">"}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.grid}>
        {WEEKDAYS.map((w, i) => (
          <Text key={`w${i}`} style={[styles.cell, styles.weekday]}>
            {w}
          </Text>
        ))}
        {cells.map((d, i) => {
          if (!d) return <View key={`e${i}`} style={styles.cell} />;
          const disabled = d < today;
          const selected = selectedDay === d.getTime();
          return (
            <TouchableOpacity
              key={`d${i}`}
              style={[styles.cell, selected && styles.cellSelected]}
              disabled={disabled}
              onPress={() => {
                const next = value ? new Date(value) : new Date();
                next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                onPick(next);
              }}
            >
              <Text
                style={[
                  styles.cellText,
                  disabled && styles.cellDisabled,
                  selected && styles.cellTextSelected,
                ]}
              >
                {d.getDate()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Sheet>
  );
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

/** Remount the draft each time the picker opens, including when value changes outside it. */
export function TimeSheet(props: {
  visible: boolean;
  value: Date | null;
  onPick: (d: Date) => void;
  onClose: () => void;
}) {
  return props.visible ? <TimeSelection {...props} /> : null;
}

function TimeSelection({
  value,
  onPick,
  onClose,
}: React.ComponentProps<typeof TimeSheet>) {
  const { height } = useWindowDimensions();
  const compact = height < 600;
  useEffect(() => {
    Keyboard.dismiss();
  }, []);
  const [base] = useState(() => new Date(value ?? new Date()));
  const [time, setTime] = useState(() => clockParts(base));
  const confirm = () => {
    onPick(withClockTime(base, time));
    onClose();
  };
  return (
    <Sheet visible title="Pick a time" onClose={onClose} onDone={confirm}>
      <View style={styles.timeRow}>
        <TimeWheel
          compact={compact}
          label="Hour"
          values={HOURS}
          value={time.hour}
          onChange={(hour) => setTime((t) => ({ ...t, hour }))}
        />
        <Text style={styles.colon}>:</Text>
        <TimeWheel
          compact={compact}
          label="Minute"
          values={MINUTES}
          value={time.minute}
          onChange={(minute) => setTime((t) => ({ ...t, minute }))}
        />
        <View style={styles.periodCol}>
          <Text style={styles.stepLabel}>AM / PM</Text>
          <View style={[styles.periodOptions, compact && { height: 132 }]}>
            {(["AM", "PM"] as const).map((period) => (
              <Pressable
                key={period}
                accessibilityRole="radio"
                accessibilityLabel={period}
                accessibilityState={{ checked: time.period === period }}
                aria-checked={time.period === period}
                style={[
                  styles.periodBtn,
                  time.period === period && styles.periodActive,
                ]}
                onPress={() => setTime((t) => ({ ...t, period }))}
              >
                <Text
                  style={[
                    styles.periodText,
                    time.period === period && styles.periodTextActive,
                  ]}
                >
                  {period}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      <Text style={styles.hint}>Scroll or tap a number to set your time.</Text>
    </Sheet>
  );
}

/** Shown the moment a finger lands on a control. */
const pressedStyle = { opacity: 0.6 };
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "90%",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sheetHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
    backgroundColor: colors.forest,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  sheetTitle: {
    ...typography.title,
    color: colors.onAccent,
    fontSize: 18,
    flex: 1,
  },
  doneTouch: {
    minWidth: 60,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  doneBtn: { ...typography.label, color: colors.gold },
  timeSheet: { padding: 16, paddingBottom: 16 },
  timeSheetHead: { backgroundColor: "transparent", padding: 0 },
  timeSheetTitle: { color: colors.text, textAlign: "center", fontSize: 17 },
  cancelBtn: { ...typography.label, color: colors.textDim },
  timeDoneTouch: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  timeDoneText: { color: colors.onAccent },
  monthRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  monthLabel: { ...typography.body, color: colors.text },
  monthNav: {
    ...typography.title,
    color: colors.accent,
    paddingHorizontal: 12,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  weekday: { ...typography.caption, color: colors.textFaint },
  cellText: { ...typography.body, color: colors.text },
  cellDisabled: { color: colors.textFaint, opacity: 0.35 },
  cellSelected: {
    backgroundColor: colors.accent,
    borderRadius: 20,
  },
  cellTextSelected: { color: colors.onAccent },
  timeRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: spacing.md,
    gap: 8,
  },
  stepLabel: {
    ...typography.label,
    color: colors.textDim,
    marginBottom: 8,
    textAlign: "center",
  },
  colon: {
    ...typography.title,
    color: colors.textDim,
    fontSize: 28,
    marginTop: 24,
  },
  periodCol: { alignItems: "center", flex: 1, minWidth: 0 },
  periodOptions: { height: 220, justifyContent: "center", gap: 8 },
  periodBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    minWidth: 64,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  periodActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  periodText: { ...typography.label, color: colors.textDim },
  periodTextActive: { color: colors.onAccent },
  hint: {
    ...typography.caption,
    color: colors.textFaint,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
