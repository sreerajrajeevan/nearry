import { test } from "node:test";
import assert from "node:assert/strict";
import { clockParts, withClockTime } from "../src/utils/timePicker";

test("all hours including noon and midnight round-trip without changing the plan day", () => {
  for (let hour = 0; hour < 24; hour++) {
    const original = new Date(2026, 11, 31, hour, 37, 25, 123);
    const parts = clockParts(original);
    assert.ok(parts.hour >= 1 && parts.hour <= 12);
    assert.equal(parts.period, hour < 12 ? "AM" : "PM");
    const result = withClockTime(original, parts);
    assert.deepEqual(
      [
        result.getFullYear(),
        result.getMonth(),
        result.getDate(),
        result.getHours(),
        result.getMinutes(),
      ],
      [2026, 11, 31, hour, 37],
    );
    assert.equal(result.getSeconds(), 0);
    assert.equal(result.getMilliseconds(), 0);
    assert.equal(original.getSeconds(), 25);
  }
});

test("AM/PM changes keep 12 AM at midnight and 12 PM at noon", () => {
  const day = new Date(2026, 10, 21, 14, 0);
  assert.equal(
    withClockTime(day, { hour: 12, minute: 0, period: "AM" }).getHours(),
    0,
  );
  assert.equal(
    withClockTime(day, { hour: 12, minute: 0, period: "PM" }).getHours(),
    12,
  );
  assert.equal(
    withClockTime(day, { hour: 7, minute: 59, period: "PM" }).getHours(),
    19,
  );
});

test("existing exact minutes are retained when reopening instead of rounding to five", () => {
  for (let minute = 0; minute < 60; minute++) {
    const value = new Date(2026, 10, 21, 23, minute);
    assert.equal(
      withClockTime(value, clockParts(value)).getTime(),
      value.getTime(),
    );
  }
});
