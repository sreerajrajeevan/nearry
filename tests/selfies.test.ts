import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { base64Bytes } from "../src/utils/base64Bytes";
import { notificationTarget } from "../src/utils/notificationTarget";
const user = "00000000-0000-0000-0000-000000000031";
const originalFetch = globalThis.fetch;
const calls: { url: URL; method: string; body: any; headers: Headers }[] = [];
let response: (
  url: URL,
  method: string,
) => { body: unknown; status?: number } = () => ({ body: {} });
let selfies: typeof import("../src/services/selfieVerification");
const jpeg = new Uint8Array([255, 216, 255, 224, 0, 16, 0, 255, 217]);
before(async () => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://selfie-test.invalid";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  const backend = await import("../src/services/supabase");
  const token = [
    "eyJhbGciOiJIUzI1NiJ9",
    Buffer.from(
      JSON.stringify({ sub: user, exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString("base64url"),
    "fake",
  ].join(".");
  const session = JSON.stringify({
    access_token: token,
    refresh_token: "fixture",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user: { id: user },
  });
  backend.configureAuthStorage({
    getItem: async (k) => (k === "sb-selfie-test-auth-token" ? session : null),
    setItem: async () => {},
    removeItem: async () => {},
  });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
        typeof input === "string" || input instanceof URL ? input : input.url,
      ),
      method = init?.method || "GET";
    calls.push({
      url,
      method,
      headers: new Headers(init?.headers),
      body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body,
    });
    const r = response(url, method);
    return new Response(JSON.stringify(r.body), {
      status: r.status || 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  selfies = await import("../src/services/selfieVerification");
});
beforeEach(() => {
  calls.length = 0;
  response = (url) =>
    url.pathname === "/auth/v1/user"
      ? { body: { id: user, email: "fixture@example.test" } }
      : { body: {} };
});
after(() => {
  globalThis.fetch = originalFetch;
});

test("selfies: native base64 decoding preserves binary image bytes with both padding forms", () => {
  for (const bytes of [
    jpeg,
    jpeg.slice(0, 8),
    jpeg.slice(0, 7),
    new Uint8Array([0, 255, 128, 22]),
  ])
    assert.deepEqual(base64Bytes(Buffer.from(bytes).toString("base64")), bytes);
  for (const invalid of ["", "not base64!", "=abc", "abc", "a==="])
    assert.throws(() => base64Bytes(invalid));
});
test("selfies: upload uses a unique private object, actual JPEG content type and explicit server consent", async () => {
  await selfies.submitSelfieImage(user, jpeg);
  const upload = calls.find((c) =>
    c.url.pathname.includes("/storage/v1/object/"),
  )!;
  assert.equal(upload.method, "POST");
  assert.match(
    upload.url.pathname,
    new RegExp(`/selfie_proofs/${user}/selfie-.+\\.jpg$`),
  );
  assert.equal(upload.headers.get("content-type"), "image/jpeg");
  assert.equal(upload.headers.get("x-upsert"), "false");
  const rpc = calls.find((c) =>
    c.url.pathname.endsWith("/rpc/submit_personal_selfie"),
  )!;
  assert.deepEqual(rpc.body, {
    p_path: upload.url.pathname.split("/selfie_proofs/")[1],
    p_consent: true,
  });
  assert.equal(
    calls.some((c) => c.method === "DELETE"),
    false,
  );
});
test("selfies: invalid images and a different authenticated user cannot upload", async () => {
  await assert.rejects(
    selfies.submitSelfieImage(user, new Uint8Array(5242881)),
    /5 MB/,
  );
  await assert.rejects(
    selfies.submitSelfieImage(user, new Uint8Array([1, 2, 3])),
    /JPEG/,
  );
  assert.equal(calls.length, 0);
  await assert.rejects(
    selfies.submitSelfieImage("another-user", jpeg),
    /sign in again/,
  );
  assert.equal(
    calls.some((c) => c.url.pathname.includes("/storage/")),
    false,
  );
});
test("selfies: a rejected submission removes the unused private object; status and public boolean disclose no proof paths", async () => {
  response = (url) =>
    url.pathname === "/auth/v1/user"
      ? { body: { id: user } }
      : url.pathname.endsWith("/rpc/submit_personal_selfie")
        ? { status: 400, body: { message: "Already pending" } }
        : { body: {} };
  await assert.rejects(
    selfies.submitSelfieImage(user, jpeg),
    /Already pending/,
  );
  const removed = calls.find((c) => c.method === "DELETE")!;
  assert.match(removed.url.pathname, /selfie_proofs$/);
  assert.equal(removed.body.prefixes.length, 1);
  calls.length = 0;
  response = (url) =>
    url.pathname.endsWith("/rpc/is_personal_selfie_checked")
      ? { body: true }
      : { body: { status: "pending", note: null, submitted_at: "2026-11-07" } };
  assert.equal((await selfies.getMySelfieReview(user)).status, "pending");
  assert.equal(
    calls[0].url.searchParams.get("select"),
    "status,note,submitted_at,reviewed_at",
  );
  assert.equal(await selfies.isPersonalSelfieChecked(user), true);
  assert.deepEqual(
    calls.find((c) =>
      c.url.pathname.endsWith("/rpc/is_personal_selfie_checked"),
    )!.body,
    { p_user: user },
  );
});
test("selfies: notification taps open the review status screen", () => {
  assert.equal(
    notificationTarget({ kind: "selfie_review" } as any, "personal").screen,
    "SelfieVerification",
  );
});

test("selfies: external or another member’s profile photo must be replaced before opening the camera", () => {
  assert.equal(
    selfies.hasSelfieComparisonAvatar(
      user,
      `https://selfie-test.invalid/storage/v1/object/public/avatars/${user}/avatar-00000000-0000-0000-0000-000000000001.jpg?t=123`,
    ),
    true,
  );
  for (const url of [
    undefined,
    "https://google.example/photo.jpg",
    `https://evil.example/storage/v1/object/public/avatars/${user}/avatar.jpg`,
    `https://selfie-test.invalid/storage/v1/object/public/avatars/other/avatar.jpg`,
  ])
    assert.equal(selfies.hasSelfieComparisonAvatar(user, url), false);
});
