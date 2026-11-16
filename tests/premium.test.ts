import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PremiumStore,
  planSavings,
  premiumBlock,
  type PurchasesAdapter,
} from "../src/services/premium";

const NOW = new Date("2026-11-16T00:00:00Z");
const FUTURE = "2026-12-16T00:00:00Z";
const PAST = "2026-10-01T00:00:00Z";

function fakeAdapter() {
  const calls: string[] = [];
  const adapter: PurchasesAdapter = {
    identify: async (id) => {
      calls.push(`identify:${id}`);
    },
    plans: async () => [
      { id: "weekly", priceString: "₹49", price: 49, pkg: "pw" },
      { id: "monthly", priceString: "₹149", price: 149, pkg: "pm" },
      { id: "quarterly", priceString: "₹349", price: 349, pkg: "pq" },
    ],
    purchase: async (pkg) => {
      calls.push(`purchase:${String(pkg)}`);
      return "done";
    },
    restore: async () => {
      calls.push("restore");
    },
    signOut: async () => {},
  };
  return { adapter, calls };
}
function make(
  over: Partial<ConstructorParameters<typeof PremiumStore>[0]> = {},
) {
  const f = fakeAdapter();
  let expiry: string | null = null;
  const syncCalls = { n: 0 };
  const store = new PremiumStore({
    adapter: f.adapter,
    userId: "u1",
    demo: false,
    readExpiry: async () => expiry,
    sync: async () => {
      syncCalls.n++;
      return FUTURE;
    },
    now: () => NOW,
    ...over,
  });
  return { store, f, syncCalls, setExpiry: (e: string | null) => (expiry = e) };
}

test("premiumBlock maps server messages", () => {
  assert.equal(premiumBlock("daily_plan_limit"), "plans");
  assert.equal(premiumBlock("daily_join_limit"), "joins");
  assert.equal(premiumBlock("premium_required"), "filter");
  assert.equal(premiumBlock("post is full"), null);
});

test("planSavings computes percent against weekly", () => {
  const out = planSavings([
    { id: "weekly", priceString: "", price: 49, savingsPercent: null, pkg: 0 },
    {
      id: "monthly",
      priceString: "",
      price: 149,
      savingsPercent: null,
      pkg: 0,
    },
    {
      id: "quarterly",
      priceString: "",
      price: 349,
      savingsPercent: null,
      pkg: 0,
    },
  ]);
  assert.deepEqual(
    out.map((p) => p.savingsPercent),
    [null, 30, 45],
  );
  const noWeekly = planSavings([
    {
      id: "monthly",
      priceString: "",
      price: 149,
      savingsPercent: null,
      pkg: 0,
    },
  ]);
  assert.equal(noWeekly[0].savingsPercent, null);
});

test("premium when expiry is in the future, even with null adapter", async () => {
  const t = make({ adapter: null, readExpiry: async () => FUTURE });
  await t.store.load();
  assert.equal(t.store.getSnapshot().status, "premium");
});

test("expired expiry is free with adapter, unavailable without", async () => {
  const a = make({ readExpiry: async () => PAST });
  await a.store.load();
  assert.equal(a.store.getSnapshot().status, "free");
  const b = make({ adapter: null });
  await b.store.load();
  assert.equal(b.store.getSnapshot().status, "unavailable");
});

test("demo is unavailable and purchase rejects without calling adapter", async () => {
  const t = make({ demo: true });
  await t.store.load();
  assert.equal(t.store.getSnapshot().status, "unavailable");
  await assert.rejects(t.store.purchase("monthly"));
  assert.ok(!t.f.calls.some((c) => c.startsWith("purchase")));
});

test("purchase calls adapter with pkg, syncs, becomes premium", async () => {
  const t = make();
  await t.store.load();
  assert.equal(t.store.getSnapshot().status, "free");
  assert.equal(await t.store.purchase("monthly"), "done");
  assert.ok(t.f.calls.includes("purchase:pm"));
  assert.equal(t.syncCalls.n, 1);
  assert.equal(t.store.getSnapshot().status, "premium");
  assert.equal(t.store.getSnapshot().busy, false);
});

test("cancelled purchase does not sync", async () => {
  const t = make();
  t.f.adapter.purchase = async () => "cancelled";
  await t.store.load();
  assert.equal(await t.store.purchase("monthly"), "cancelled");
  assert.equal(t.syncCalls.n, 0);
  assert.equal(t.store.getSnapshot().status, "free");
});

test("sync failure after purchase rethrows friendly error; restore recovers", async () => {
  let fail = true;
  const t = make({
    sync: async () => {
      if (fail) throw new Error("network");
      return FUTURE;
    },
  });
  await t.store.load();
  await assert.rejects(t.store.purchase("weekly"), /still confirming/);
  assert.equal(t.store.getSnapshot().busy, false);
  assert.equal(t.store.getSnapshot().status, "free");
  fail = false;
  await t.store.restore();
  assert.equal(t.store.getSnapshot().status, "premium");
});
