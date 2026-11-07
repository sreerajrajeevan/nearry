import { test } from "node:test";
import assert from "node:assert/strict";
import { createSignInFetch } from "../src/services/signInTransport";
import {
  EmailCodeCooldowns,
  normalizeEmailCode,
  GOOGLE_SIGN_IN_PARAMS,
} from "../src/utils/emailSignIn";
import { friendlyAuthError } from "../src/utils/authError";

test("email codes: native keyboards, spaces and leading zeroes preserve the full numeric code", () => {
  for (const value of [
    " 0123 4567 ",
    "０１２３４５６７",
    "٠١٢٣٤٥٦٧",
    "۰۱۲۳۴۵۶۷",
    "०१२३४५६७",
  ])
    assert.equal(normalizeEmailCode(value), "01234567");
  assert.equal(normalizeEmailCode("012345678901"), "0123456789");
});
test("resend cooldown: switching to another email does not inherit the old recipient’s wait", () => {
  let now = 1000;
  const limits = new EmailCodeCooldowns(() => now);
  limits.record(" First@Example.com ");
  assert.equal(limits.expiresAt("first@example.com"), 61000);
  assert.equal(limits.expiresAt("another@example.com"), 0);
  now = 2000;
  limits.record("another@example.com");
  assert.equal(limits.expiresAt("FIRST@example.com"), 61000);
  assert.equal(limits.expiresAt("another@example.com"), 62000);
});
test("Google login: account selection does not repeatedly force consent or request offline provider access", () => {
  assert.deepEqual(GOOGLE_SIGN_IN_PARAMS, { prompt: "select_account" });
});
test("sign-in transport: a stalled request aborts and releases the caller instead of leaving Proceed busy", async () => {
  let signal: AbortSignal | undefined;
  const request = createSignInFetch(
    "https://auth.invalid",
    ((_input, init) => {
      signal = init?.signal as AbortSignal;
      return new Promise(() => {});
    }) as typeof fetch,
    15,
  );
  await assert.rejects(
    request("https://auth.invalid/auth/v1/otp", { method: "POST" }),
    /connection took too long/,
  );
  assert.equal(signal?.aborted, true);
});
test("sign-in transport: the deadline includes a stalled JSON response body", async () => {
  const request = createSignInFetch(
    "https://auth.invalid",
    (async () => ({
      text: () => new Promise(() => {}),
    })) as unknown as typeof fetch,
    15,
  );
  await assert.rejects(
    request("https://auth.invalid/auth/v1/verify"),
    /connection took too long/,
  );
});
test("sign-in transport: provider errors, API headers and no-content sign-out responses survive unchanged", async () => {
  const request = createSignInFetch(
    "https://auth.invalid",
    (async () =>
      new Response(
        JSON.stringify({
          code: "over_email_send_rate_limit",
          msg: "Email rate limit reached",
        }),
        {
          status: 429,
          headers: {
            "content-type": "application/json",
            "x-supabase-api-version": "2024-01-01",
          },
        },
      )) as typeof fetch,
  );
  const result = await request("https://auth.invalid/auth/v1/otp");
  assert.equal(result.status, 429);
  assert.equal(result.headers.get("x-supabase-api-version"), "2024-01-01");
  assert.equal((await result.json()).code, "over_email_send_rate_limit");
  const logout = createSignInFetch(
    "https://auth.invalid",
    (async () => new Response(null, { status: 204 })) as typeof fetch,
  );
  assert.equal(
    (await logout("https://auth.invalid/auth/v1/logout")).status,
    204,
  );
});
test("sign-in transport: profile hydration has a deadline; uploads and unrelated endpoints retain their transport", async () => {
  let observed: any;
  const fetcher = (async (_input, init) => {
    observed = init;
    return new Response("{}");
  }) as typeof fetch;
  const request = createSignInFetch("https://auth.invalid", fetcher, 15);
  const ownSignal = new AbortController().signal;
  await request("https://auth.invalid/storage/v1/object/photos/test.jpg", {
    signal: ownSignal,
  });
  assert.equal(observed.signal, ownSignal);
  await request("https://another.invalid/auth/v1/token", { signal: ownSignal });
  assert.equal(observed.signal, ownSignal);
  const profile = createSignInFetch(
    "https://auth.invalid",
    (() => new Promise(() => {})) as typeof fetch,
    15,
  );
  await assert.rejects(
    profile("https://auth.invalid/rest/v1/rpc/get_my_profile"),
    /connection took too long/,
  );
});
test("sign-in transport: caller cancellation still reaches the underlying request", async () => {
  let underlying: AbortSignal | undefined;
  const caller = new AbortController();
  const request = createSignInFetch(
    "https://auth.invalid",
    (async (_input, init) => {
      underlying = init?.signal as AbortSignal;
      return new Promise((_r, reject) =>
        underlying!.addEventListener("abort", () =>
          reject(new Error("cancelled")),
        ),
      );
    }) as typeof fetch,
    200,
  );
  const pending = request("https://auth.invalid/auth/v1/otp", {
    signal: caller.signal,
  });
  caller.abort();
  await assert.rejects(pending, /cancelled/);
  assert.equal(underlying?.aborted, true);
});
test("network failures explain a retry; sender restrictions never masquerade as a delivered code", () => {
  assert.match(
    friendlyAuthError("Network request failed"),
    /Check your connection/,
  );
  assert.match(
    friendlyAuthError("failure", "email_address_not_authorized"),
    /delivery needs to be configured/,
  );
});
