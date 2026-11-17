import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialOnboardingDraft,
  onboardingResumeStep,
  OnboardingDraftStore,
  type OnboardingDraft,
} from "../src/services/onboardingDrafts";

const now = Date.parse("2026-11-18T12:00:00Z");
const complete: OnboardingDraft = {
  ...initialOnboardingDraft(null),
  name: "Sree",
  dob: "1998-03-12",
  gender: "male",
  interests: ["Badminton", "Cafés"],
  preferences: {
    days: ["Sat"],
    times: ["Evening"],
    radiusKm: 10,
    area: {
      label: "Kakkanad",
      latitude: 10,
      longitude: 76,
      source: "google",
      acquiredAt: new Date(now - 1000).toISOString(),
    },
  },
  photo: "file:///app/private/sree/crop.jpg",
  uploadedPhoto: null,
};
function fixture() {
  const values = new Map<string, string>();
  let time = now;
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
    values,
    storage,
    store: new OnboardingDraftStore(storage, () => time),
    advance: (ms: number) => {
      time += ms;
    },
    clock: () => time,
  };
}

test("explore and later CompleteProfile restore the same fields and each of the five personal steps", async () => {
  const f = fixture();
  for (const step of [0, 1, 2, 3, 4]) {
    const before = { ...complete, step };
    await f.store.open("sree", "personal").save(before);
    // A new store instance represents an app restart, not just screen memory.
    const restored = await new OnboardingDraftStore(f.storage, f.clock)
      .open("sree", "personal")
      .read();
    assert.deepEqual(restored, before);
    assert.equal(onboardingResumeStep(restored!, "personal"), step);
  }
});
test("partially entered details stay filled without skipping required age, gender or name", async () => {
  const f = fixture();
  const partial = {
    ...complete,
    name: "S",
    dob: "1998-03-",
    gender: undefined,
    step: 4,
  };
  await f.store.open("sree", "personal").save(partial);
  const restored = (await f.store.open("sree", "personal").read())!;
  assert.equal(restored.name, "S");
  assert.equal(restored.dob, "1998-03-");
  assert.equal(onboardingResumeStep(restored, "personal"), 0);
  // Legacy accounts can complete later with a server-saved age and no full birthday.
  assert.equal(
    onboardingResumeStep({ ...complete, dob: "", step: 3 }, "personal", 25),
    3,
  );
});
test("business steps resume independently, and an incomplete business area returns to its own page", async () => {
  const f = fixture();
  const business = {
    ...complete,
    businessName: "Sunday Coffee",
    category: "Café",
    area: "Kakkanad",
    step: 2,
  };
  await f.store.open("sree", "business").save(business);
  const restored = (await f.store.open("sree", "business").read())!;
  assert.equal(onboardingResumeStep(restored, "business"), 2);
  assert.equal(onboardingResumeStep({ ...restored, area: "" }, "business"), 1);
  assert.equal(await f.store.open("sree", "personal").read(), null);
  assert.equal(await f.store.open("friend", "business").read(), null);
});
test("drafts never record terms consent, session tokens or completion flags", async () => {
  const f = fixture();
  await f.store
    .open("sree", "personal")
    .save({
      ...complete,
      agreed: true,
      termsAccepted: true,
      onboardingCompleted: true,
      accessToken: "not-a-real-token",
    } as OnboardingDraft);
  const raw = [...f.values.values()][0];
  for (const key of [
    "agreed",
    "termsAccepted",
    "onboardingCompleted",
    "accessToken",
    "not-a-real-token",
  ])
    assert.ok(!raw.includes(key), key);
});
test("corrupt, expired, future and wrong-owner records cannot restore another person's setup", async () => {
  for (const kind of [
    "corrupt",
    "expired",
    "future",
    "wrong owner",
    "wrong role",
  ] as const) {
    const f = fixture();
    await f.store.open("sree", "personal").save(complete);
    const key = [...f.values.keys()][0];
    if (kind === "corrupt") f.values.set(key, "broken json");
    else if (kind === "expired") f.advance(30 * 86400000);
    else if (kind === "future") f.advance(-1);
    else {
      const row = JSON.parse(f.values.get(key)!);
      row[kind === "wrong owner" ? "id" : "role"] = "other";
      f.values.set(key, JSON.stringify(row));
    }
    assert.equal(await f.store.open("sree", "personal").read(), null, kind);
    assert.equal(f.values.size, 0, kind);
  }
});
test("restoring an older draft drops expired Google coordinates without losing fields or step", async () => {
  const f = fixture();
  await f.store.open("sree", "personal").save({ ...complete, step: 4 });
  f.advance(29 * 86400000);
  const restored = (await f.store.open("sree", "personal").read())!;
  assert.equal(restored.preferences.area, undefined);
  assert.equal(restored.name, "Sree");
  assert.equal(restored.step, 4);
});
test("an immediate Explore flush and remount read wait for earlier writes instead of restoring stale values", async () => {
  const f = fixture();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let writes = 0;
  const store = new OnboardingDraftStore(
    {
      ...f.storage,
      setItem: async (key, value) => {
        if (++writes === 1) await gate;
        await f.storage.setItem(key, value);
      },
    },
    f.clock,
  );
  const session = store.open("sree", "personal");
  const old = session.save({ ...complete, name: "First", step: 0 });
  const flush = session.save({ ...complete, name: "Latest", step: 3 });
  const returning = store.open("sree", "personal").read();
  release();
  await old;
  await flush;
  assert.equal((await returning)?.name, "Latest");
  assert.equal((await store.open("sree", "personal").read())?.step, 3);
});
test("completion/sign-out clears both roles and stale unmounted-screen saves cannot resurrect the draft", async () => {
  const f = fixture();
  const stale = f.store.open("sree", "personal");
  await stale.save(complete);
  await f.store.open("sree", "business").save(complete);
  await f.store
    .open("friend", "personal")
    .save({ ...complete, name: "Friend" });
  const clearing = f.store.clear("sree");
  assert.equal(await stale.save({ ...complete, step: 4 }), false);
  await clearing;
  assert.equal(await f.store.open("sree", "personal").read(), null);
  assert.equal(await f.store.open("sree", "business").read(), null);
  assert.equal(
    (await f.store.open("friend", "personal").read())?.name,
    "Friend",
  );
});
test("clearing an in-flight write wins over its later completion", async () => {
  const f = fixture();
  let started!: () => void, release!: () => void;
  const began = new Promise<void>((resolve) => {
    started = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const store = new OnboardingDraftStore(
    {
      ...f.storage,
      setItem: async (key, value) => {
        started();
        await gate;
        await f.storage.setItem(key, value);
      },
    },
    f.clock,
  );
  const old = store.open("sree", "personal");
  const saving = old.save(complete);
  await began;
  const clearing = store.clear("sree");
  release();
  assert.equal(await saving, false);
  await clearing;
  assert.equal(f.values.size, 0);
  assert.equal(await old.save(complete), false);
});
test("storage failures are surfaced for Retry, and do not poison the next successful save", async () => {
  const f = fixture();
  let fail = true;
  const store = new OnboardingDraftStore(
    {
      ...f.storage,
      getItem: async (key) => {
        if (fail) throw Error("read failed");
        return f.storage.getItem(key);
      },
      setItem: async (key, value) => {
        if (fail) throw Error("disk full");
        await f.storage.setItem(key, value);
      },
    },
    f.clock,
  );
  const session = store.open("sree", "personal");
  await assert.rejects(session.read(), /read failed/);
  await assert.rejects(session.save(complete), /disk full/);
  fail = false;
  assert.equal(await session.save(complete), true);
  assert.equal((await session.read())?.name, "Sree");
});
