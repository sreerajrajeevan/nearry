import test from "node:test";
import assert from "node:assert/strict";
import { SignupAgreementStore } from "../src/services/terms";
import { POLICY_VERSION } from "../src/utils/legal";

function fixture(accept: (userId: string) => Promise<void> = async () => {}) {
  const values = new Map<string, string>();
  let now = 1000;
  const storage = {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: async (key: string) => {
      values.delete(key);
    },
  };
  return {
    store: new SignupAgreementStore(storage, accept, () => now),
    storage,
    values,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

test("unchecked signup never creates an acceptance intent", async () => {
  const f = fixture();
  await assert.rejects(f.store.begin("email", false, "a@example.com"), /agree/);
  assert.equal(f.values.size, 0);
});

test("email agreement is consumed once, for the matching verified address", async () => {
  const accepted: string[] = [];
  const f = fixture(async (id) => {
    accepted.push(id);
  });
  await f.store.begin("email", true, " Person@Example.com ");
  assert.equal(
    await f.store.complete("email", "other", "other@example.com"),
    false,
  );
  assert.equal(await f.store.complete("google", "person"), false);
  assert.deepEqual(accepted, []);
  assert.equal(
    await f.store.complete("email", "person", "person@example.com"),
    true,
  );
  assert.equal(
    await f.store.complete("email", "person", "person@example.com"),
    false,
  );
  assert.deepEqual(accepted, ["person"]);
});

test("Google redirect can recover the checked signup intent after a page reload", async () => {
  const accepted: string[] = [];
  const f = fixture();
  await f.store.begin("google", true);
  const reloaded = new SignupAgreementStore(
    f.storage,
    async (id) => {
      accepted.push(id);
    },
    () => 1000,
  );
  assert.equal(await reloaded.complete("google", "google-user"), true);
  assert.deepEqual(accepted, ["google-user"]);
});

test("normal login clears signup consent rather than applying it to a later account", async () => {
  const f = fixture(async () => {
    assert.fail("must not accept");
  });
  await f.store.begin("google", true);
  await f.store.clear();
  assert.equal(await f.store.complete("google", "returning-user"), false);
});

test("expired, changed-policy and malformed intents do not record acceptance", async () => {
  for (const kind of ["expired", "old-policy", "malformed"] as const) {
    const f = fixture(async () => {
      assert.fail("must not accept");
    });
    await f.store.begin("google", true);
    const [key, raw] = [...f.values][0];
    if (kind === "expired") f.advance(60 * 60 * 1000 + 1);
    if (kind === "old-policy")
      f.values.set(
        key,
        JSON.stringify({
          ...JSON.parse(raw),
          version: POLICY_VERSION + "-old",
        }),
      );
    if (kind === "malformed") f.values.set(key, "{");
    assert.equal(await f.store.complete("google", "person"), false);
    assert.equal(f.values.size, 0);
  }
});

test("duplicate OAuth callbacks share one acceptance write", async () => {
  let writes = 0;
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const f = fixture(async () => {
    writes++;
    await barrier;
  });
  await f.store.begin("google", true);
  const a = f.store.complete("google", "person");
  const b = f.store.complete("google", "person");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(writes, 1);
  release();
  assert.deepEqual(await Promise.all([a, b]), [true, true]);
});

test("failed acceptance is retryable and never marked saved", async () => {
  let writes = 0;
  const f = fixture(async () => {
    if (++writes === 1) throw new Error("offline");
  });
  await f.store.begin("email", true, "person@example.com");
  await assert.rejects(
    f.store.complete("email", "person", "person@example.com"),
    /offline/,
  );
  assert.equal(f.values.size, 1);
  assert.equal(
    await f.store.complete("email", "person", "person@example.com"),
    true,
  );
  assert.equal(f.values.size, 0);
});

test("an older completed callback cannot erase a newer signup intent", async () => {
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const f = fixture(async () => {
    await barrier;
  });
  await f.store.begin("email", true, "first@example.com");
  const old = f.store.complete("email", "first", "first@example.com");
  await new Promise((resolve) => setTimeout(resolve, 0));
  await f.store.begin("email", true, "second@example.com");
  release();
  await old;
  assert.equal(
    JSON.parse([...f.values.values()][0]).email,
    "second@example.com",
  );
});
