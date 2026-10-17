import test from "node:test";
import assert from "node:assert/strict";
import { parseDateTime } from "../src/utils/dateTime";
import { RequestVersion } from "../src/utils/requestVersion";
import {
  validatePostDraft,
  validateOfferInput,
  isValidEmail,
  isValidOtp,
} from "../src/utils/validation";
import { toNeedPost, toProfile, toDbNewPost } from "../src/services/mappers";
test("reject impossible calendar/time values", () => {
  for (const [date, time] of [
    ["2026-02-30", "10:00"],
    ["2026-10-12", "25:00"],
    ["bad", "10:00"],
    ["2026-13-01", "10:00"],
  ])
    assert.equal(parseDateTime(date, time), null);
  assert.ok(parseDateTime("2028-02-29", "10:00"));
});
test("stale async profile result is invalid after sign-out/new request", () => {
  const versions = new RequestVersion();
  const old = versions.next();
  versions.invalidate();
  assert.equal(versions.current(old), false);
  const a = versions.next(),
    b = versions.next();
  assert.equal(versions.current(a), false);
  assert.equal(versions.current(b), true);
});
test("email and OTP validation", () => {
  assert.ok(isValidEmail("a@b.com"));
  assert.equal(isValidEmail("a@"), false);
  assert.ok(isValidOtp("123456"));
  assert.equal(isValidOtp("abc123"), false);
});
test("post validation and explicit snake-case write mapping", () => {
  const input = {
    title: "Football",
    description: "Friendly game tonight",
    startsAt: new Date(Date.now() + 3600000).toISOString(),
    vacancies: 2,
    tags: ["sports"],
  };
  assert.equal(
    validatePostDraft({ ...input, startsAt: new Date(input.startsAt) }),
    null,
  );
  assert.ok(
    validatePostDraft({
      ...input,
      startsAt: new Date(input.startsAt),
      vacancies: 0,
    }),
  );
  const mapped = toDbNewPost("host", input);
  assert.equal(mapped.author_id, "host");
  assert.equal(mapped.starts_at, input.startsAt);
  assert.equal("startsAt" in mapped, false);
});
test("slot validation rejects NaN prices, invalid durations, missing resources", () => {
  const input = {
    title: "Offer now",
    description: "Description long enough",
    startsAt: new Date(Date.now() + 3600000).toISOString(),
    endsAt: new Date(Date.now() + 7200000).toISOString(),
    slotCapacity: 2,
  };
  assert.equal(validateOfferInput(input), null);
  for (const extra of [
    { priceCents: NaN },
    { slotMinutes: 0 },
    { slotMinutes: 120 },
    { resourceKey: "" },
  ])
    assert.ok(validateOfferInput({ ...input, ...extra }));
});
test("profile mapper preserves explicit first-time role selection", () => {
  const p = toProfile({
    id: "u",
    account_type: "business",
    display_name: "Business",
    avatar_url: null,
    bio: null,
    interests: null,
    business_name: null,
    business_details: null,
    verification_status: "unverified",
    onboarding_completed: false,
    role_selected: false,
    created_at: "",
  });
  assert.equal(p.roleSelected, false);
  assert.equal(p.accountType, "business");
});

test("offer validation rejects nonfinite discounts and oversized text", () => {
  const offer = {
    title: "Haircut",
    description: "Friendly salon haircut",
    startsAt: new Date(Date.now() + 3600000).toISOString(),
    endsAt: new Date(Date.now() + 7200000).toISOString(),
    slotCapacity: 1,
  };
  for (const patch of [
    { discountPct: NaN },
    { discountPct: 0.5 },
    { title: "x".repeat(81) },
    { description: "x".repeat(1001) },
  ])
    assert.ok(validateOfferInput({ ...offer, ...patch }));
});
