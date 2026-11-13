import React, { useState } from "react";
import { Platform, Text, TextInput, View, StyleSheet } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { MotionPressable } from "../Motion";
import { Icon } from "../Icon";
import { ageFromBirthday, birthdayString } from "../../utils/onboarding";
import { ob, onboardingColors as c, OnboardingLink } from "./OnboardingKit";

/** Native year-aware date picker; accessible numeric fields for web previews. */
export function BirthdayField({
  value,
  onChange,
  disabled = false,
  savedAge,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  savedAge?: number;
}) {
  const [open, setOpen] = useState(false);
  const [year, month, day] = value.split("-");
  const today = new Date();
  const latest = new Date(
    today.getFullYear() - 18,
    today.getMonth(),
    today.getDate(),
  );
  const earliest = new Date(
    today.getFullYear() - 101,
    today.getMonth(),
    today.getDate() + 1,
  );
  const parsed =
    value && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(Number(year), Number(month) - 1, Number(day))
      : latest;
  const safe = ageFromBirthday(value) !== null ? parsed : latest;
  return (
    <View>
      <Text style={ob.label}>Date of birth</Text>
      {Platform.OS === "web" ? (
        <View style={styles.webFields}>
          {(
            [
              ["Day", day ?? "", 2],
              ["Month", month ?? "", 2],
              ["Year", year ?? "", 4],
            ] as const
          ).map(([label, part, length], index) => (
            <TextInput
              key={label}
              accessibilityLabel={`Birth ${label.toLowerCase()}`}
              placeholder={
                label === "Year" ? "YYYY" : label === "Month" ? "MM" : "DD"
              }
              keyboardType="number-pad"
              editable={!disabled}
              maxLength={length}
              value={part}
              onChangeText={(text) => {
                const parts = [day ?? "", month ?? "", year ?? ""];
                parts[index] = text.replace(/\D/g, "");
                onChange(`${parts[2]}-${parts[1]}-${parts[0]}`);
              }}
              style={[styles.field, index === 2 && { flex: 1.4 }]}
            />
          ))}
        </View>
      ) : (
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel={
            value ? `Date of birth ${value}` : "Choose date of birth"
          }
          disabled={disabled}
          onPress={() => setOpen(true)}
          style={styles.control}
        >
          <Text style={[styles.copy, !value && { color: c.muted }]}>
            {value ? `${day}/${month}/${year}` : "Choose your birthday"}
          </Text>
          <Icon name="calendar" size={20} color={c.ink} />
        </MotionPressable>
      )}
      {open && Platform.OS !== "web" && (
        <DateTimePicker
          value={safe}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          minimumDate={earliest}
          maximumDate={latest}
          onChange={(event, date) => {
            if (Platform.OS !== "ios") setOpen(false);
            if (event.type !== "dismissed" && date)
              onChange(birthdayString(date));
          }}
        />
      )}
      {open && Platform.OS === "ios" && (
        <OnboardingLink title="Done" onPress={() => setOpen(false)} />
      )}
      <Text style={ob.help}>
        {savedAge && !value
          ? `Your saved age is ${savedAge}. Choose a birthday only to update it. `
          : ""}
        Only your age is saved. Nearry is for ages 18+.
      </Text>
      {!!value && ageFromBirthday(value) === null && (
        <Text accessibilityRole="alert" style={ob.error}>
          Enter a valid birthday. Your age must be between 18 and 100.
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  control: {
    minHeight: 54,
    padding: 15,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 14,
    backgroundColor: c.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  copy: { fontSize: 16, color: c.ink },
  webFields: { flexDirection: "row", gap: 8 },
  field: {
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    padding: 12,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 14,
    backgroundColor: c.white,
    fontSize: 16,
    color: c.ink,
  },
});
