import { test } from "node:test";
import assert from "node:assert/strict";
import { SavedPlansStore } from "../src/services/savedPlans";
function fixture() {
  const data = new Map<string, string>();
  let failWrite = false;
  const storage = {
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      if (failWrite) throw new Error("Disk unavailable");
      data.set(key, value);
    },
  };
  return {
    data,
    storage,
    failWrites: (value: boolean) => {
      failWrite = value;
    },
  };
}
test("bookmarks survive reload and remain isolated between accounts", async () => {
  const f = fixture(),
    alice = new SavedPlansStore(f.storage, "alice"),
    bob = new SavedPlansStore(f.storage, "bob");
  await alice.toggle("post-1");
  await alice.toggle("post-2");
  assert.deepEqual(await new SavedPlansStore(f.storage, "alice").load(), [
    "post-1",
    "post-2",
  ]);
  assert.deepEqual(await bob.load(), []);
  await alice.toggle("post-1");
  assert.deepEqual(alice.getSnapshot().ids, ["post-2"]);
});
test("concurrent bookmark toggles are serialized without losing saved plans", async () => {
  const f = fixture(),
    store = new SavedPlansStore(f.storage, "alice");
  await Promise.all([
    store.toggle("a"),
    store.toggle("b"),
    store.toggle("c"),
    store.toggle("b"),
  ]);
  assert.deepEqual(store.getSnapshot().ids, ["a", "c"]);
  assert.deepEqual(await new SavedPlansStore(f.storage, "alice").load(), [
    "a",
    "c",
  ]);
});
test("failed bookmark writes leave the confirmed state intact and permit retry", async () => {
  const f = fixture(),
    store = new SavedPlansStore(f.storage, "alice");
  await store.toggle("a");
  f.failWrites(true);
  await assert.rejects(store.toggle("b"), /Could not save/);
  assert.deepEqual(store.getSnapshot().ids, ["a"]);
  f.failWrites(false);
  await store.toggle("b");
  assert.deepEqual(store.getSnapshot().ids, ["a", "b"]);
});
test("corrupt bookmark storage is not overwritten and a repaired value can be retried", async () => {
  const f = fixture(),
    store = new SavedPlansStore(f.storage, "alice");
  f.data.set("nearry.saved-plans.v1:alice", "invalid-json");
  await assert.rejects(store.toggle("a"), /Could not load/);
  assert.equal(f.data.get("nearry.saved-plans.v1:alice"), "invalid-json");
  f.data.set("nearry.saved-plans.v1:alice", '["b","b"]');
  await store.toggle("a");
  assert.deepEqual(store.getSnapshot().ids, ["b", "a"]);
});
