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
  assert.deepEqual(ids(all), [
    "coffee-today",
    "coffee-saturday",
    "football-saturday",
    "paid-sunday",
    "unknown-cost",
    "coffee-monday",
  ]);
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

test("home excludes the viewer's posts across date/free filters without matching by display name", () => {
  const now = local(2026, 11, 8, 10);
  const mine = plan("mine", local(2026, 11, 8, 18), {
    authorId: "viewer",
    authorName: "Sree",
  });
  const other = plan("other", local(2026, 11, 8, 18), {
    authorId: "another-host",
    authorName: "Sree",
  });
  const posts = [mine, other];
  for (const date of ["all", "today", "weekend"] as const) {
    for (const freeOnly of [false, true]) {
      assert.deepEqual(
        discoveryPlans(
          posts,
          { ...all, date, freeOnly, excludeAuthorId: "viewer" },
          now,
        ),
        [other],
      );
    }
  }
  assert.deepEqual(
    discoveryPlans([mine], { ...all, excludeAuthorId: "viewer" }, now),
    [],
  );
  // Filtering the discovery feed neither deletes nor changes the host's record.
  assert.deepEqual(posts, [mine, other]);
  assert.deepEqual(discoveryPlans(posts, all, now), [mine, other]);
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

test("audience filters distinguish unrestricted plans from women-only and men-only plans", () => {
  const now = local(2026, 11, 8, 10);
  const time = local(2026, 11, 8, 18);
  const posts = [
    plan("a-unspecified", time),
    plan("b-everyone", time, { genderPreference: "any" }),
    plan("c-women", time, { genderPreference: "female" }),
    plan("d-men", time, { genderPreference: "male" }),
  ];
  const ids = (audience: "all" | "any" | "female" | "male") =>
    discoveryPlans(posts, { ...all, audience }, now).map((p) => p.id);
  assert.deepEqual(
    ids("all"),
    posts.map((p) => p.id),
  );
  assert.deepEqual(ids("any"), ["a-unspecified", "b-everyone"]);
  assert.deepEqual(ids("female"), ["c-women"]);
  assert.deepEqual(ids("male"), ["d-men"]);
});

test("distance boundaries are inclusive and missing/invalid distances never pass a radius filter", () => {
  const now = local(2026, 11, 8, 10);
  const distances = new Map([
    ["zero", 0],
    ["two", 2],
    ["five", 5],
    ["ten", 10],
    ["twenty-five", 25],
    ["outside", 25.001],
    ["negative", -1],
    ["nan", NaN],
    ["infinite", Infinity],
  ]);
  const keys = [
    "zero",
    "two",
    "five",
    "ten",
    "twenty-five",
    "outside",
    "negative",
    "nan",
    "infinite",
    "unknown",
  ];
  const posts = keys.map((id) =>
    plan(id, local(2026, 11, 8, 18), { venueId: id }),
  );
  const unlocated = plan("no-venue", local(2026, 11, 8, 18));
  for (const [radius, expected] of [
    [2, ["two", "zero"]],
    [5, ["five", "two", "zero"]],
    [10, ["five", "ten", "two", "zero"]],
    [25, ["five", "ten", "twenty-five", "two", "zero"]],
  ] as const) {
    assert.deepEqual(
      discoveryPlans(
        [...posts, unlocated],
        { ...all, maxDistanceKm: radius, distances },
        now,
      ).map((p) => p.id),
      expected,
    );
  }
});

test("starting soon, nearest and newest have distinct orders without mutating the feed", () => {
  const now = local(2026, 11, 8, 10);
  const posts = [
    plan("later-nearer", local(2026, 11, 9, 18), {
      venueId: "near",
      createdAt: local(2026, 11, 6).toISOString(),
    }),
    plan("soon-farther", local(2026, 11, 8, 18), {
      venueId: "far",
      createdAt: local(2026, 11, 7).toISOString(),
    }),
    plan("newest-unknown", local(2026, 11, 10, 18), {
      createdAt: local(2026, 11, 8).toISOString(),
    }),
  ];
  const original = [...posts];
  const distances = new Map([
    ["near", 0.5],
    ["far", 4],
  ]);
  const ids = (sort: "soonest" | "nearest" | "newest") =>
    discoveryPlans(posts, { ...all, sort, distances }, now).map((p) => p.id);
  assert.deepEqual(ids("soonest"), [
    "soon-farther",
    "later-nearer",
    "newest-unknown",
  ]);
  assert.deepEqual(ids("nearest"), [
    "later-nearer",
    "soon-farther",
    "newest-unknown",
  ]);
  assert.deepEqual(ids("newest"), [
    "newest-unknown",
    "soon-farther",
    "later-nearer",
  ]);
  assert.deepEqual(posts, original);
});

test("nearest puts known distances first, with deterministic start-time/ID ties", () => {
  const now = local(2026, 11, 8, 10);
  const posts = [
    plan("z-known", local(2026, 11, 9, 18), { venueId: "same" }),
    plan("a-known", local(2026, 11, 9, 18), { venueId: "same" }),
    plan("early-known", local(2026, 11, 8, 18), { venueId: "same" }),
    plan("early-unknown", local(2026, 11, 8, 11)),
    plan("invalid-distance", local(2026, 11, 10, 18), { venueId: "bad" }),
  ];
  assert.deepEqual(
    discoveryPlans(
      posts,
      {
        ...all,
        sort: "nearest",
        distances: new Map([
          ["same", 1],
          ["bad", NaN],
        ]),
      },
      now,
    ).map((p) => p.id),
    ["early-known", "a-known", "z-known", "early-unknown", "invalid-distance"],
  );
});

test("all filters combine and never reveal own, expired or cancelled plans", () => {
  const now = local(2026, 11, 8, 10);
  const base = { venueId: "near", genderPreference: "female" as const };
  const make = (id: string, patch: Partial<NeedPost> = {}) =>
    plan(id, local(2026, 11, 8, 18), { ...base, ...patch });
  const posts = [
    make("match"),
    make("mine", { authorId: "viewer" }),
    make("paid", { costCents: 100 }),
    make("unknown-cost", { costCents: undefined }),
    make("men", { genderPreference: "male" }),
    make("far", { venueId: "far" }),
    make("no-place", { venueId: undefined }),
    make("cancelled", { status: "cancelled" }),
    make("expired", { expiresAt: now.toISOString() }),
    make("tomorrow", { startsAt: local(2026, 11, 9, 18).toISOString() }),
    make("sports", { title: "Football", tags: ["football"] }),
  ];
  assert.deepEqual(
    discoveryPlans(
      posts,
      {
        date: "today",
        category: "Meet",
        freeOnly: true,
        audience: "female",
        maxDistanceKm: 2,
        sort: "nearest",
        excludeAuthorId: "viewer",
        distances: new Map([
          ["near", 1],
          ["far", 10],
        ]),
      },
      now,
    ).map((p) => p.id),
    ["match"],
  );
});

test("invalid creation dates sort after dated posts, with stable ties", () => {
  const now = local(2026, 11, 8, 10);
  const time = local(2026, 11, 8, 18);
  const posts = [
    plan("z", time, { createdAt: "invalid" }),
    plan("a", time, { createdAt: "invalid" }),
    plan("dated", time),
  ];
  assert.deepEqual(
    discoveryPlans(posts, { ...all, sort: "newest" }, now).map((p) => p.id),
    ["dated", "a", "z"],
  );
});

test("This week uses Monday–Sunday calendar boundaries, including year rollover", () => {
  for (const now of [local(2026, 12, 31), local(2027, 1, 3)]) {
    assert.equal(
      matchesPlanDate(local(2026, 12, 27, 23, 59).toISOString(), "week", now),
      false,
    );
    assert.equal(
      matchesPlanDate(local(2026, 12, 28, 0).toISOString(), "week", now),
      true,
    );
    assert.equal(
      matchesPlanDate(local(2027, 1, 3, 23, 59).toISOString(), "week", now),
      true,
    );
    assert.equal(
      matchesPlanDate(local(2027, 1, 4, 0).toISOString(), "week", now),
      false,
    );
  }
});
