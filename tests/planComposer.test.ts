import { test } from "node:test";
import assert from "node:assert/strict";
import {
  composerDays,
  samePlanDay,
  planCostCents,
  planPreferencesError,
} from "../src/utils/planComposer";
test("quick dates stay in the local calendar over month/year boundaries", () => {
  const now = new Date(2026, 11, 31, 23, 40),
    days = composerDays(now);
  assert.equal(days[0].date.getDate(), 31);
  assert.equal(days[1].date.getFullYear(), 2027);
  assert.equal(days[1].date.getMonth(), 0);
  assert.equal(days[1].date.getDate(), 1);
  assert.equal(days[2].date.getDay(), 6);
  assert.equal(days[3].date.getDay(), 0);
  assert.ok(days.slice(1).every((d) => d.date > days[0].date));
  assert.equal(samePlanDay(new Date(2026, 11, 31, 19), days[0].date), true);
});
test("split fee includes the host, preserves paise and rejects invalid amounts", () => {
  assert.equal(planCostCents("split", "600", 2), 20000);
  assert.equal(planCostCents("person", "199.99", 4), 19999);
  assert.equal(planCostCents("free", "600", 2), 0);
  assert.equal(planCostCents("person", "", 2), undefined);
  assert.equal(planCostCents("split", "-10", 2), undefined);
  assert.equal(planCostCents("person", "5.2.4", 2), undefined);
});
test("age preferences reject impossible or underage ranges before publishing", () => {
  for (const range of [
    { ageMin: 17 },
    { ageMax: 101 },
    { ageMin: 40, ageMax: 20 },
    { ageMin: 18.5 },
  ])
    assert.ok(planPreferencesError(range));
  assert.equal(planPreferencesError({ ageMin: 18, ageMax: 100 }), null);
});
