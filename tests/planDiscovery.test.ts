import test from "node:test";
import assert from "node:assert/strict";
import { matchesPlanDate, planCost } from "../src/utils/planDiscovery";

const local = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(y, m - 1, d, h, min);

test("Today uses local calendar boundaries and excludes tomorrow at midnight", () => {
  const now = local(2026, 12, 31, 23, 55);
  assert.equal(
    matchesPlanDate(local(2026, 12, 31, 0).toISOString(), "today", now),
    true,
  );
  assert.equal(
    matchesPlanDate(local(2027, 1, 1, 0).toISOString(), "today", now),
    false,
  );
  assert.equal(
    matchesPlanDate(local(2026, 12, 30, 23, 59).toISOString(), "today", now),
    false,
  );
  assert.equal(matchesPlanDate("invalid", "today", now), false);
});

test("This weekend covers upcoming Saturday and Sunday, including month/year rollover", () => {
  const now = local(2026, 12, 31);
  assert.equal(
    matchesPlanDate(local(2027, 1, 1, 23, 59).toISOString(), "weekend", now),
    false,
  );
  assert.equal(
    matchesPlanDate(local(2027, 1, 2, 0).toISOString(), "weekend", now),
    true,
  );
  assert.equal(
    matchesPlanDate(local(2027, 1, 3, 23, 59).toISOString(), "weekend", now),
    true,
  );
  assert.equal(
    matchesPlanDate(local(2027, 1, 4, 0).toISOString(), "weekend", now),
    false,
  );
});

test("Saturday and Sunday keep the current weekend rather than skipping to the next one", () => {
  for (const day of [7, 8]) {
    const now = local(2026, 11, day);
    assert.equal(
      matchesPlanDate(local(2026, 11, 8, 18).toISOString(), "weekend", now),
      true,
    );
    assert.equal(
      matchesPlanDate(local(2026, 11, 14).toISOString(), "weekend", now),
      false,
    );
  }
});

test("unspecified costs are never advertised as free and fractional rupees are preserved", () => {
  assert.equal(planCost({}), "Cost not specified");
  assert.equal(planCost({ costCents: 0 }), "Free to join");
  assert.equal(planCost({ costCents: 15000 }), "₹150 / person");
  assert.equal(planCost({ costCents: 1050 }), "₹10.5 / person");
});
