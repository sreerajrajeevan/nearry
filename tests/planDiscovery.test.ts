import test from "node:test";
import assert from "node:assert/strict";
import {
  discoveryPlans,
  matchesPlanDate,
  planCost,
} from "../src/utils/planDiscovery";
import { formatWhen } from "../src/utils/format";
import type { NeedPost } from "../src/services/mappers";

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

test("weekend means Saturday/Sunday from every day of the week, never Friday or Monday", () => {
  for (let day = 2; day <= 8; day++) {
    const now = local(2026, 11, day);
    for (let candidate = 1; candidate <= 15; candidate++) {
      assert.equal(
        matchesPlanDate(
          local(2026, 11, candidate).toISOString(),
          "weekend",
          now,
        ),
        candidate === 7 || candidate === 8,
        `November ${day} filtering November ${candidate}`,
      );
    }
  }
});

const plan = (
  id: string,
  startsAt: Date,
  patch: Partial<NeedPost> = {},
): NeedPost => ({
  id,
  authorId: "host",
  authorName: "Host",
  title: "Coffee after work",
  description: "",
  startsAt: startsAt.toISOString(),
  tags: ["coffee"],
  vacancies: 2,
  joinedCount: 0,
  spotsLeft: 2,
  status: "open",
  costCents: 0,
  createdAt: startsAt.toISOString(),
  ...patch,
});
const all = { date: "all", category: null, freeOnly: false } as const;

test("date, category and free filters combine over the actual feed and reset restores results", () => {
  const now = local(2026, 11, 6, 10);
  const posts = [
    plan("coffee-today", local(2026, 11, 6, 18)),
    plan("coffee-saturday", local(2026, 11, 7, 18)),
    plan("paid-sunday", local(2026, 11, 8, 18), { costCents: 5000 }),
    plan("unknown-cost", local(2026, 11, 8, 18), { costCents: undefined }),
    plan("football-saturday", local(2026, 11, 7, 18), {
      title: "Football at 8",
      tags: ["football"],
    }),
    plan("coffee-monday", local(2026, 11, 9, 18)),
  ];
  const ids = (filters: Parameters<typeof discoveryPlans>[1]) =>
    discoveryPlans(posts, filters, now).map((p) => p.id);
  assert.deepEqual(ids({ ...all, date: "today" }), ["coffee-today"]);
  assert.deepEqual(ids({ date: "weekend", category: "Meet", freeOnly: true }), [
    "coffee-saturday",
  ]);
  assert.deepEqual(ids({ date: "weekend", category: "Play", freeOnly: true }), [
    "football-saturday",
  ]);
  assert.deepEqual(
    ids(all),
    posts.map((p) => p.id),
  );
});

test("cached expired/closed plans disappear and Today changes when midnight passes", () => {
  const before = local(2026, 12, 31, 23, 59);
  const after = local(2027, 1, 1, 0);
  const posts = [
    plan("tonight", new Date(before.getTime() + 30_000)),
    plan("tomorrow", local(2027, 1, 1, 10)),
    plan("expired", local(2027, 1, 1, 10), { expiresAt: before.toISOString() }),
    plan("cancelled", local(2027, 1, 1, 10), { status: "cancelled" }),
    plan("closed", local(2027, 1, 1, 10), { status: "closed" }),
    plan("invalid", local(2027, 1, 1, 10), { startsAt: "invalid" }),
  ];
  const filters = { ...all, date: "today" } as const;
  assert.deepEqual(
    discoveryPlans(posts, filters, before).map((p) => p.id),
    ["tonight"],
  );
  assert.deepEqual(
    discoveryPlans(posts, filters, after).map((p) => p.id),
    ["tomorrow"],
  );
  assert.deepEqual(
    discoveryPlans(posts, all, after).map((p) => p.id),
    ["tomorrow"],
  );
});

test("full future plans retain their honest Full status rather than being silently hidden", () => {
  const now = local(2026, 11, 8, 10);
  const full = plan("full", local(2026, 11, 8, 18), {
    spotsLeft: 0,
    joinedCount: 2,
  });
  assert.deepEqual(discoveryPlans([full], { ...all, date: "today" }, now), [
    full,
  ]);
});

test("date labels handle New Year and DST calendar changes", () => {
  assert.equal(
    formatWhen(local(2027, 1, 1, 9).toISOString(), local(2026, 12, 31, 23)),
    "Tomorrow, 9 am",
  );
  assert.equal(
    formatWhen(local(2026, 3, 9, 9).toISOString(), local(2026, 3, 8, 1)),
    "Tomorrow, 9 am",
  );
  assert.equal(
    formatWhen(local(2026, 11, 2, 9).toISOString(), local(2026, 11, 1, 1)),
    "Tomorrow, 9 am",
  );
});

test("unspecified costs are never advertised as free and fractional rupees are preserved", () => {
  assert.equal(planCost({}), "Cost not specified");
  assert.equal(planCost({ costCents: 0 }), "Free to join");
  assert.equal(planCost({ costCents: 15000 }), "₹150 / person");
  assert.equal(planCost({ costCents: 1050 }), "₹10.5 / person");
});
