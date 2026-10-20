import React, { useState } from "react";
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet } from "react-native";
import { colors, typography, spacing } from "../theme";

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
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={styles.doneBtn}>Done</Text>
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </TouchableOpacity>
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

function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  const range = max - min + 1;
  const wrap = (v: number) => min + ((((v - min) % range) + range) % range);
  const dec = () => onChange(wrap(value - step));
  const inc = () => onChange(wrap(value + step));
  // Typed value while the field is being edited; null = show the value.
  const [draft, setDraft] = useState<string | null>(null);
  const commitDraft = () => {
    if (draft === null) return;
    const n = parseInt(draft.replace(/\D/g, ""), 10);
    if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
    setDraft(null);
  };
  return (
    <View style={styles.stepCol}>
      <Text style={styles.stepLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.stepBtn}
        onPress={inc}
        activeOpacity={0.8}
      >
        <Text style={styles.stepText}>+</Text>
      </TouchableOpacity>
      <TextInput
        style={styles.stepInput}
        value={draft ?? String(value).padStart(2, "0")}
        keyboardType="number-pad"
        maxLength={2}
        selectTextOnFocus
        onChangeText={setDraft}
        onBlur={commitDraft}
        onSubmitEditing={commitDraft}
        accessibilityLabel={`${label} value, type to change`}
      />
      <TouchableOpacity
        style={styles.stepBtn}
        onPress={dec}
        activeOpacity={0.8}
      >
        <Text style={styles.stepText}>-</Text>
      </TouchableOpacity>
    </View>
  );
}

/** Time bottom sheet: 12-hour clock with AM/PM. */
export function TimeSheet({
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
  const base = value ?? new Date();
  const h24 = base.getHours();
  const [hour12, setHour12] = useState(h24 % 12 === 0 ? 12 : h24 % 12);
  const [period, setPeriod] = useState<"AM" | "PM">(h24 < 12 ? "AM" : "PM");
  const [minute, setMinute] = useState(base.getMinutes());
  const confirm = () => {
    const h = period === "AM" ? hour12 % 12 : (hour12 % 12) + 12;
    const next = new Date(base);
    next.setHours(h, minute, 0, 0);
    onPick(next);
    onClose();
  };
  return (
    <Sheet visible={visible} title="Pick a time" onClose={confirm}>
      <View style={styles.timeRow}>
        <Stepper
          label="HOUR"
          value={hour12}
          onChange={setHour12}
          min={1}
          max={12}
        />
        <Text style={styles.colon}>:</Text>
        <Stepper
          label="MIN"
          value={minute}
          onChange={setMinute}
          min={0}
          max={59}
          step={5}
        />
        <View style={styles.periodCol}>
          <Text style={styles.stepLabel}> </Text>
          {(["AM", "PM"] as const).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && styles.periodActive]}
              onPress={() => setPeriod(p)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.periodText,
                  period === p && styles.periodTextActive,
                ]}
              >
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <Text style={styles.hint}>Tap DONE when set.</Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
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
  },
  sheetTitle: { ...typography.title, color: colors.text, fontSize: 18 },
  doneBtn: { ...typography.label, color: colors.red },
  monthRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  monthLabel: { ...typography.body, color: colors.text },
  monthNav: { ...typography.title, color: colors.red, paddingHorizontal: 12 },
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
    backgroundColor: colors.red,
    borderRadius: 20,
  },
  cellTextSelected: { color: colors.onAccent },
  timeRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: spacing.md,
  },
  stepCol: { alignItems: "center", marginHorizontal: spacing.lg },
  stepLabel: { ...typography.label, color: colors.textDim, marginBottom: 4 },
  stepBtn: {
    width: 56,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 4,
  },
  stepText: { color: colors.text, fontSize: 22 },
  stepInput: {
    ...typography.title,
    color: colors.text,
    fontSize: 28,
    minWidth: 56,
    textAlign: "center",
    paddingVertical: 2,
  },
  colon: { ...typography.title, color: colors.textDim, fontSize: 28 },
  periodCol: { alignItems: "center", marginLeft: spacing.lg },
  periodBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginVertical: 4,
  },
  periodActive: { backgroundColor: colors.red, borderColor: colors.red },
  periodText: { ...typography.label, color: colors.textDim },
  periodTextActive: { color: colors.onAccent },
  hint: {
    ...typography.caption,
    color: colors.textFaint,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
