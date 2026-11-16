import test from "node:test";
import assert from "node:assert/strict";
import { notificationTarget } from "../src/utils/notificationTarget";
import { shouldCelebrateVerified } from "../src/utils/verifiedCelebration";
import type { AppNotification } from "../src/services/mappers";

const now = Date.parse("2026-11-16T12:00:00Z");
const reviewedAt = "2026-11-16T11:30:00Z";

test("tapping the selfie notification opens the profile to celebrate", () => {
  assert.deepEqual(
    notificationTarget(
      { id: "n1", kind: "selfie_review" } as AppNotification,
      "personal",
    ),
    {
      screen: "PersonalTabs",
      params: { screen: "Profile", params: { celebrate: "n1" } },
    },
  );
});

test("the verified moment plays once per approval, and only when verified", () => {
  const base = { verified: true, reviewedAt, now };
  assert.equal(shouldCelebrateVerified({ ...base, seen: null }), true);
  assert.equal(shouldCelebrateVerified({ ...base, seen: reviewedAt }), false);
  // A removed and repeated check has a new review time.
  assert.equal(
    shouldCelebrateVerified({ ...base, seen: "2026-10-01T00:00:00Z" }),
    true,
  );
  // The notification tap always plays it, even if seen before.
  assert.equal(
    shouldCelebrateVerified({
      ...base,
      seen: reviewedAt,
      fromNotification: true,
    }),
    true,
  );
  assert.equal(
    shouldCelebrateVerified({
      ...base,
      verified: false,
      fromNotification: true,
    }),
    false,
  );
});

test("an old approval does not suddenly celebrate on a new phone", () => {
  assert.equal(
    shouldCelebrateVerified({
      verified: true,
      reviewedAt: "2026-09-01T00:00:00Z",
      seen: null,
      now,
    }),
    false,
  );
  assert.equal(
    shouldCelebrateVerified({ verified: true, reviewedAt: "nope", now }),
    false,
  );
});
