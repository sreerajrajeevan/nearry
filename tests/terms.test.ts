import { test, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import { POLICY_VERSION } from "../src/utils/legal";

let db: ReturnType<typeof import("../src/services/supabase").requireSupabase>;
let terms: typeof import("../src/services/terms");
let originalSession: typeof db.auth.getSession;
let originalRpc: typeof db.rpc;
before(async () => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://terms-test.invalid";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  const { requireSupabase } = await import("../src/services/supabase");
  db = requireSupabase();
  terms = await import("../src/services/terms");
  originalSession = db.auth.getSession;
  originalRpc = db.rpc;
});
afterEach(() => {
  db.auth.getSession = originalSession;
  db.rpc = originalRpc;
});

test("final review consent records the current policy and explicit adult confirmation for the authenticated account", async () => {
  const writes: unknown[] = [];
  db.auth.getSession = (async () => ({
    data: { session: { user: { id: "owner" } } },
    error: null,
  })) as typeof db.auth.getSession;
  db.rpc = ((name: string, body: unknown) => {
    writes.push({ name, body });
    return Promise.resolve({ error: null });
  }) as unknown as typeof db.rpc;
  await terms.acceptCurrentTerms("owner");
  assert.deepEqual(writes, [
    {
      name: "accept_community_terms",
      body: { p_version: POLICY_VERSION, p_adult: true },
    },
  ]);
});

test("account changes or a missing session cannot transfer final review consent", async () => {
  let writes = 0;
  db.rpc = (() => {
    writes++;
    return Promise.resolve({ error: null });
  }) as unknown as typeof db.rpc;
  for (const session of [null, { user: { id: "other" } }]) {
    db.auth.getSession = (async () => ({
      data: { session },
      error: null,
    })) as typeof db.auth.getSession;
    await assert.rejects(terms.acceptCurrentTerms("owner"), /Account changed/);
  }
  assert.equal(writes, 0);
});

test("a failed final consent write stays failed and can be retried", async () => {
  db.auth.getSession = (async () => ({
    data: { session: { user: { id: "owner" } } },
    error: null,
  })) as typeof db.auth.getSession;
  db.rpc = (() =>
    Promise.resolve({
      error: new Error("Offline"),
    })) as unknown as typeof db.rpc;
  await assert.rejects(terms.acceptCurrentTerms("owner"), /Offline/);
  db.rpc = (() => Promise.resolve({ error: null })) as unknown as typeof db.rpc;
  await terms.acceptCurrentTerms("owner");
});
