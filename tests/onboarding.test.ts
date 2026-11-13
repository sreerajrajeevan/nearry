import test from "node:test";
import assert from "node:assert/strict";
import {
  ageFromBirthday,
  birthdayString,
  onboardingPreferences,
  onboardingLane,
} from "../src/utils/onboarding";
test("birthday eligibility uses calendar dates, rejects rollover dates and never guesses adulthood", () => {
  const today = new Date(2026, 10, 13);
  assert.equal(ageFromBirthday("2008-11-13", today), 18);
  assert.equal(ageFromBirthday("2008-11-14", today), null);
  assert.equal(ageFromBirthday("1925-11-14", today), 100);
  assert.equal(ageFromBirthday("1925-11-13", today), null);
  assert.equal(ageFromBirthday("2000-02-29", today), 26);
  for (const value of [
    "2001-02-29",
    "2000-02-31",
    "2030-01-01",
    "2000-13-01",
    "0000-01-01",
    "13/11/2000",
    "2000-1-01",
    "",
  ])
    assert.equal(ageFromBirthday(value, today), null, value);
  assert.equal(birthdayString(new Date(2000, 0, 2)), "2000-01-02");
});
test("availability and radius are bounded; expired, invalid and future location caches cannot drive discovery", () => {
  const now = Date.parse("2026-11-13T12:00:00Z");
  const area = {
    label: "Kakkanad",
    latitude: 10,
    longitude: 76,
    source: "google",
    acquiredAt: "2026-11-13T11:00:00Z",
  };
  assert.deepEqual(
    onboardingPreferences(
      {
        days: ["Sat", "Sat", "bad"],
        times: ["Night", "all"],
        radiusKm: 10,
        area,
      },
      now,
    ),
    { days: ["Sat"], times: ["Night"], radiusKm: 10, area },
  );
  for (const patch of [
    { latitude: 91 },
    { longitude: Infinity },
    { label: "" },
    { acquiredAt: "2026-10-14T11:00:00Z" },
    { acquiredAt: "2026-11-14T11:00:00Z" },
    { source: undefined },
  ])
    assert.equal(
      onboardingPreferences({ area: { ...area, ...patch } }, now).area,
      undefined,
    );
  for (const input of [
    null,
    undefined,
    [],
    { radiusKm: 999 },
    { days: "Sat", times: "Night" },
  ])
    assert.deepEqual(onboardingPreferences(input, now), {
      days: [],
      times: [],
      radiusKm: 5,
    });
});
test("first setup keeps personal browsing optional, business setup required, and celebration visible after save", () => {
  assert.equal(onboardingLane("personal", true, false, false), "personal");
  assert.equal(onboardingLane("personal", true, true, false), null);
  assert.equal(onboardingLane("business", true, true, false), "business");
  assert.equal(onboardingLane("personal", false, false, false), null);
  assert.equal(onboardingLane("business", false, false, true), "business");
  assert.equal(onboardingLane("personal", false, true, true), "personal");
  assert.equal(onboardingLane(null, true, false, true), null);
});
