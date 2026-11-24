import { test } from "node:test";
import assert from "node:assert/strict";
import { urgentAllowed } from "../src/utils/urgentPlan";

test("players-needed alerts only for plans starting within 6 hours", () => {
  const now = Date.parse("2026-11-24T10:00:00Z");
  const at = (min: number) => new Date(now + min * 60_000);
  assert.equal(urgentAllowed(at(5 * 60 + 59), now), true);
  assert.equal(urgentAllowed(at(6 * 60 + 1), now), false);
  assert.equal(urgentAllowed(at(-1), now), false);
  assert.equal(urgentAllowed(null, now), false);
});
