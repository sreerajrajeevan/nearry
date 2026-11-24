import { test } from "node:test";
import assert from "node:assert/strict";
import { createChunkedAuthStorage } from "../src/services/chunkedAuthStorage";
import { withDeadline } from "../src/utils/deadline";
import { sameOAuthRoute } from "../src/utils/oauthRoute";
import { parsePendingRole } from "../src/utils/pendingRole";
const memory = () => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: async (k: string) => values.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: async (k: string) => {
      values.delete(k);
    },
  };
};
const fixture = () => {
  const secure = memory(),
    legacy = memory();
  let version = 0;
  return {
    secure,
    legacy,
    store: createChunkedAuthStorage(
      secure,
      legacy,
      () => `generation-${++version}`,
    ),
  };
};
test("native sessions migrate out of plaintext and round-trip large Unicode metadata", async () => {
  const { secure, legacy, store } = fixture(),
    token = JSON.stringify({
      access_token: "private-jwt",
      name: "🙌മലയാളം".repeat(800),
    });
  await legacy.setItem("session", token);
  assert.equal(await store.getItem("session"), token);
  assert.equal(await legacy.getItem("session"), null);
  assert.equal(
    [...legacy.values.values()].some((v) => v.includes("private-jwt")),
    false,
  );
  for (const [key, value] of secure.values)
    if (key.includes("generation-"))
      assert.ok(Buffer.byteLength(value, "utf8") <= 1800);
  assert.equal(await store.getItem("session"), token);
});
test("failed native write leaves the prior committed session readable", async () => {
  const { secure, legacy, store } = fixture();
  await store.setItem("session", "original");
  const write = secure.setItem;
  secure.setItem = async (k, v) => {
    if (k.includes("generation-2")) throw new Error("storage full");
    return write(k, v);
  };
  await assert.rejects(store.setItem("session", "new"));
  assert.equal(await store.getItem("session"), "original");
  assert.equal(await legacy.getItem("session"), null);
});
test("sign-out tombstone prevents restoring a session when secure deletion fails", async () => {
  const { secure, legacy, store } = fixture();
  await store.setItem("session", "secret");
  secure.removeItem = async () => {
    throw new Error("locked");
  };
  await store.removeItem("session");
  assert.equal(await store.getItem("session"), null);
  // A fresh instance must honor it too, rather than resurrecting an old secure token.
  assert.equal(
    await createChunkedAuthStorage(
      secure,
      legacy,
      () => "generation-fresh",
    ).getItem("session"),
    null,
  );
});
test("auth storage serializes refresh/removal and can sign in after sign-out", async () => {
  const { store } = fixture();
  await Promise.all([
    store.setItem("session", "old"),
    store.setItem("session", "refresh"),
    store.removeItem("session"),
  ]);
  assert.equal(await store.getItem("session"), null);
  await store.setItem("session", "new login");
  assert.equal(await store.getItem("session"), "new login");
});
test("incomplete secure sessions fail closed instead of using plaintext fallback", async () => {
  const { secure, legacy, store } = fixture();
  await store.setItem("session", "secret");
  const part = [...secure.values.keys()].find((k) => k.endsWith(".0"))!;
  secure.values.delete(part);
  await legacy.setItem("session", "stale secret");
  await assert.rejects(store.getItem("session"), /incomplete/);
});
test("deadline rejects unresponsive native work and consumes a late rejection", async () => {
  await assert.rejects(
    withDeadline(new Promise(() => {}), 5, "GPS unavailable"),
    /GPS unavailable/,
  );
  assert.equal(await withDeadline(Promise.resolve(42), 100), 42);
  await assert.rejects(
    withDeadline(Promise.reject(new Error("network")), 100),
    /network/,
  );
});
test("OAuth normalizes only the trusted native callback route", () => {
  assert.equal(
    sameOAuthRoute(
      "nearry:///auth/callback?code=123",
      "nearry://auth/callback",
    ),
    true,
  );
  assert.equal(
    sameOAuthRoute("nearry://auth/callback?code=123", "nearry://auth/callback"),
    true,
  );
  for (const url of [
    "evil://auth/callback",
    "nearry://evil/auth/callback",
    "nearry://auth/callback/other",
    "https://evil.example/auth/callback",
    "nearry://user@auth/callback",
  ])
    assert.equal(sameOAuthRoute(url, "nearry://auth/callback"), false, url);
  assert.equal(
    sameOAuthRoute(
      "https://app.example/auth/callback?code=x",
      "https://app.example/auth/callback",
    ),
    true,
  );
});
test("pending login lane expires and never accepts legacy or future timestamps", () => {
  const now = 5_000_000;
  assert.equal(
    parsePendingRole(JSON.stringify({ role: "business", at: now - 100 }), now),
    "business",
  );
  for (const value of [
    "business",
    "null",
    "{}",
    JSON.stringify({ role: "admin", at: now }),
    JSON.stringify({ role: "personal", at: now + 1 }),
    JSON.stringify({ role: "personal", at: now - 3_600_000 }),
  ])
    assert.equal(parsePendingRole(value, now), null);
});
import { parseDeferredPlan } from "../src/utils/deferredPlan";
import { parsePage, mergePage, pageSize } from "../src/utils/pagination";
import { photoThumbnail } from "../src/utils/photoRendition";
import { planDateBounds, matchesPlanDate } from "../src/utils/planDiscovery";
import { setActiveChat, isActiveChat } from "../src/services/activeChat";
test("deferred plan TTL rejects malformed, stale and future links", () => {
  const id = "00000000-0000-0000-0000-000000000001",
    now = 5_000_000;
  assert.deepEqual(
    parseDeferredPlan(JSON.stringify({ id, at: now - 1 }), now),
    { id, at: now - 1 },
  );
  for (const value of [
    null,
    "{}",
    JSON.stringify({ id: "not-a-plan", at: now }),
    JSON.stringify({ id, at: now + 1 }),
    JSON.stringify({ id, at: now - 3600000 }),
  ])
    assert.equal(parseDeferredPlan(value, now), null);
});
test("paged responses reject corrupt cursors and merge retries without duplicating rows", () => {
  assert.deepEqual(
    mergePage(
      [{ id: "1", v: "old" }],
      [
        { id: "1", v: "new" },
        { id: "2", v: "two" },
      ],
    ),
    [
      { id: "1", v: "new" },
      { id: "2", v: "two" },
    ],
  );
  for (const value of [
    null,
    { items: [], cursor: { at: "bad", id: "1" } },
    { items: Array(81).fill({}), cursor: null },
    { items: [null], cursor: null },
  ])
    assert.throws(() => parsePage(value), /Could not/);
  assert.equal(pageSize(500), 80);
  assert.equal(pageSize(-1), 1);
});
test("thumbnail URLs preserve old uploads and only replace known generated companions", () => {
  const original =
    "https://project.supabase.co/storage/v1/object/public/photos/u/posts/unique-full.jpg";
  assert.equal(photoThumbnail(original), original.replace("-full", "-thumb"));
  for (const url of [
    "https://image.example/full.jpg",
    "file:///private/full.jpg",
    "https://project.supabase.co/storage/v1/object/public/avatars/u/avatar.jpg",
  ])
    assert.equal(photoThumbnail(url), url);
});
test("active chat teardown cannot suppress a later conversation's push", () => {
  const stopA = setActiveChat("a"),
    stopB = setActiveChat("b");
  stopA();
  assert.equal(isActiveChat("b"), true);
  assert.equal(isActiveChat("a"), false);
  stopB();
  assert.equal(isActiveChat("b"), false);
});
test("server date bounds use the same local calendar as Today and weekend chips", () => {
  for (const day of [
    "2026-11-18T23:45:00",
    "2026-11-21T10:00:00",
    "2026-11-22T20:00:00",
    "2026-03-08T08:00:00",
  ]) {
    const now = new Date(day);
    for (const filter of ["today", "week", "weekend"] as const) {
      const bounds = planDateBounds(filter, now);
      for (let h = 0; h < 24 * 9; h += 3) {
        const candidate = new Date(now.getTime() + h * 3600000).toISOString();
        assert.equal(
          (!bounds.from || candidate >= bounds.from) &&
            (!bounds.until || candidate < bounds.until),
          matchesPlanDate(candidate, filter, now),
          filter + " " + candidate,
        );
      }
    }
  }
});
import { deadlineFetch } from "../supabase/functions/_shared/workerFetch";
test("worker I/O rejects stalled headers and stalled bodies without exposing request data", async () => {
  await assert.rejects(
    deadlineFetch(
      (async () => new Promise(() => {})) as typeof fetch,
      5,
    )("https://worker.test"),
    /timed out/,
  );
  await assert.rejects(
    deadlineFetch(
      (async () => ({
        text: async () => new Promise(() => {}),
      })) as unknown as typeof fetch,
      5,
    )("https://worker.test"),
    /timed out/,
  );
  const result = await deadlineFetch(
    (async () => new Response('{"ok":true}')) as typeof fetch,
    100,
  )("https://worker.test");
  assert.deepEqual(await result.json(), { ok: true });
});
