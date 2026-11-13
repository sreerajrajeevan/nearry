import { test } from "node:test";
import assert from "node:assert/strict";
import { AccountChoiceStore } from "../src/services/accountChoice";
import type { Profile } from "../src/services/mappers";

const fresh = (accountType: "personal" | "business" = "personal"): Profile => ({
  id: "new-user",
  accountType,
  displayName: "",
  interests: [],
  businessDetails: {},
  verificationStatus: "unverified",
  onboardingCompleted: false,
  roleSelected: false,
  createdAt: "2026-11-13T00:00:00Z",
});
function fixture() {
  const values = new Map<string, string>();
  const storage = {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: async (key: string) => {
      values.delete(key);
    },
  };
  let now = 1000;
  let current = true;
  let saved = fresh();
  const writes: string[] = [];
  const io = {
    isCurrent: () => current,
    select: async (role: "personal" | "business") => {
      writes.push(role);
      saved = { ...saved, accountType: role, roleSelected: true };
    },
    read: async () => saved,
  };
  return {
    values,
    storage,
    writes,
    io,
    store: new AccountChoiceStore(storage, () => now),
    advance: (ms: number) => {
      now += ms;
    },
    logout: () => {
      current = false;
    },
    user: { id: saved.id, email: "person@example.com" },
  };
}

test("both explicit account choices survive a Google redirect/reload and skip the second picker", async () => {
  for (const role of ["personal", "business"] as const) {
    const f = fixture();
    await f.store.begin(role, "google");
    const reloaded = new AccountChoiceStore(f.storage, () => 1000);
    const saved = await reloaded.resolve(fresh(), f.user, f.io);
    assert.equal(saved.roleSelected, true);
    assert.equal(saved.accountType, role);
    assert.deepEqual(f.writes, [role]);
    assert.equal(f.values.size, 0);
    // Choice persistence does not imply age/terms consent.
    assert.equal(saved.termsVersion, undefined);
    assert.equal(saved.onboardingCompleted, false);
  }
});

test("email choice is applied only to the recipient that requested the code", async () => {
  const f = fixture();
  await f.store.begin("business", "email", " Person@Example.com ");
  assert.equal(
    (
      await f.store.resolve(
        fresh(),
        { ...f.user, email: "other@example.com" },
        f.io,
      )
    ).roleSelected,
    false,
  );
  assert.deepEqual(f.writes, []);
  assert.equal(
    (await f.store.resolve(fresh(), f.user, f.io)).accountType,
    "business",
  );
});

test("returning accounts keep their saved role even when the opposite login lane was chosen", async () => {
  for (const role of ["personal", "business"] as const) {
    const f = fixture();
    await f.store.begin(
      role === "personal" ? "business" : "personal",
      "google",
    );
    const existing = { ...fresh(role), roleSelected: true };
    assert.equal(await f.store.resolve(existing, f.user, f.io), existing);
    assert.deepEqual(f.writes, []);
    assert.equal(f.values.size, 0);
  }
});

test("missing, expired, future and malformed choices use the manual account picker", async () => {
  for (const kind of [
    "missing",
    "expired",
    "future",
    "malformed",
    "invalid role",
    "legacy hint",
  ] as const) {
    const f = fixture();
    if (kind !== "missing") await f.store.begin("business", "google");
    if (kind === "expired") f.advance(3600001);
    if (kind === "future") f.advance(-1);
    if (kind === "malformed") f.values.set("nearry.accountChoice", "broken");
    if (kind === "invalid role") {
      const choice = JSON.parse(f.values.get("nearry.accountChoice")!);
      f.values.set(
        "nearry.accountChoice",
        JSON.stringify({ ...choice, role: "admin" }),
      );
    }
    if (kind === "legacy hint") {
      f.values.delete("nearry.accountChoice");
      f.values.set("nearry.pendingRole", "business");
    }
    assert.equal(
      (await f.store.resolve(fresh(), f.user, f.io)).roleSelected,
      false,
    );
    assert.deepEqual(f.writes, []);
  }
});

test("simultaneous auth-event and callback hydration share one account-type write", async () => {
  const f = fixture();
  await f.store.begin("business", "google");
  const saved = await Promise.all(
    Array.from({ length: 5 }, () => f.store.resolve(fresh(), f.user, f.io)),
  );
  assert.ok(saved.every((p) => p.roleSelected && p.accountType === "business"));
  assert.deepEqual(f.writes, ["business"]);
});

test("temporary selection failure retains the choice so Retry can complete without another picker", async () => {
  const f = fixture();
  await f.store.begin("business", "google");
  await assert.rejects(
    f.store.resolve(fresh(), f.user, {
      ...f.io,
      select: async () => {
        throw new Error("Offline");
      },
    }),
    /Offline/,
  );
  assert.equal(f.values.size, 1);
  assert.equal(
    (await f.store.resolve(fresh(), f.user, f.io)).accountType,
    "business",
  );
});

test("a concurrent saved account type wins over an obsolete selection", async () => {
  const f = fixture();
  await f.store.begin("business", "google");
  const saved = await f.store.resolve(fresh(), f.user, {
    ...f.io,
    select: async () => {
      throw new Error("Account type already selected");
    },
    read: async () => ({ ...fresh("personal"), roleSelected: true }),
  });
  assert.equal(saved.accountType, "personal");
  assert.equal(saved.roleSelected, true);
});

test("sign-out, a newer choice, and mismatched profiles never select for the stale account", async () => {
  const f = fixture();
  await f.store.begin("business", "google");
  f.logout();
  await f.store.resolve(fresh(), f.user, f.io);
  assert.deepEqual(f.writes, []);
  await f.store.clear();
  assert.equal(f.values.size, 0);
  await assert.rejects(
    f.store.resolve(fresh(), { id: "other" }, f.io),
    /Account changed/,
  );
});

test("an older completion does not erase a newer login choice", async () => {
  const f = fixture();
  await f.store.begin("business", "google");
  await f.store.resolve(fresh(), f.user, {
    ...f.io,
    select: async (role) => {
      await f.io.select(role);
      await f.store.begin("personal", "google");
    },
  });
  assert.equal(
    JSON.parse(f.values.get("nearry.accountChoice")!).role,
    "personal",
  );
});

test("sign-out during the stored-choice read prevents a later account-type write", async () => {
  const f = fixture();
  await f.store.begin("business", "google");
  const getItem = f.storage.getItem;
  let reads = 0;
  f.storage.getItem = async (key) => {
    if (++reads === 2) f.logout();
    return getItem(key);
  };
  await f.store.resolve(fresh(), f.user, f.io);
  assert.deepEqual(f.writes, []);
});
