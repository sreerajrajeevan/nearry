import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  bundleOfferEligible,
  bundleStatus,
} from "../src/utils/planOfferBundle";
import type { PlanOfferBundle } from "../src/utils/planOfferBundle";
import type { Offer } from "../src/services/mappers";

const now = Date.now();
const bundle: PlanOfferBundle = {
  postId: "plan",
  planTitle: "Badminton",
  bookingId: "booking",
  businessName: "Arena",
  offerTitle: "Court offer",
  venueName: "Arena Court 1",
  startsAt: new Date(now + 3600000).toISOString(),
  endsAt: new Date(now + 7200000).toISOString(),
  partySize: 4,
  priceCents: 15000,
  status: "pending",
  holdExpiresAt: new Date(now + 1800000).toISOString(),
};
test("a venue hold is never presented as a confirmed reservation, and expires without a cleanup job", () => {
  assert.equal(bundleStatus(bundle, now), "pending");
  assert.equal(bundleStatus(bundle, now + 1800000), "expired");
  assert.equal(
    bundleStatus({ ...bundle, status: "confirmed" }, now + 1800000),
    "confirmed",
  );
  assert.equal(
    bundleStatus({ ...bundle, bookingId: undefined }, now),
    "cancelled",
  );
  assert.equal(
    bundleStatus({ ...bundle, holdExpiresAt: undefined }, now),
    "expired",
  );
});
test("only live fixed-price venue offers with supported durations are attachable", () => {
  const offer = {
    status: "live",
    venueId: "arena",
    priceCents: 15000,
    slotMinutes: 60,
  } as Offer;
  assert.equal(bundleOfferEligible(offer), true);
  assert.equal(bundleOfferEligible({ ...offer, priceCents: 0 }), true);
  assert.equal(bundleOfferEligible({ ...offer, priceCents: undefined }), false);
  assert.equal(bundleOfferEligible({ ...offer, status: "draft" }), false);
  assert.equal(bundleOfferEligible({ ...offer, slotMinutes: 15 }), false);
  assert.equal(bundleOfferEligible({ ...offer, venueId: undefined }), false);
});

const originalFetch = globalThis.fetch;
const calls: { url: URL; body: any }[] = [];
let response: any = null;
let status = 200;
let api: typeof import("../src/services/planOfferBundles");
before(async () => {
  process.env.EXPO_PUBLIC_PLAN_OFFER_BUNDLES = "true";
  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://nearry-test.invalid";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      typeof input === "string" || input instanceof URL ? input : input.url,
    );
    calls.push({
      url,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    });
    return new Response(JSON.stringify(response), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  api = await import("../src/services/planOfferBundles");
});
beforeEach(() => {
  calls.length = 0;
  response = null;
  status = 200;
});
after(() => {
  globalThis.fetch = originalFetch;
});

test("bundle publishing uses one atomic RPC, keeps its retry key and never supplies a forged venue, price or time", async () => {
  response = { post_id: "saved-plan", booking_id: "saved-booking" };
  const input = {
    title: " Badminton tonight ",
    description: " Friendly game with a local offer ",
    startsAt: new Date(now + 3600000).toISOString(),
    vacancies: 3,
    tags: ["sports"],
    venueId: "forged-venue",
    venueName: "forged-name",
    costCents: 1,
    genderPreference: "female" as const,
  };
  assert.equal(
    await api.createPlanOfferBundle("slot", input, "retry-key", 15000),
    "saved-plan",
  );
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.pathname.endsWith("/rpc/create_plan_offer_bundle"));
  assert.equal(calls[0].body.p_client_key, "retry-key");
  assert.equal(calls[0].body.p_expected_price_cents, 15000);
  assert.equal(calls[0].body.p_post.gender_preference, "female");
  for (const field of [
    "venue_id",
    "venue_name",
    "cost_cents",
    "starts_at",
    "status",
    "author_id",
  ])
    assert.equal(field in calls[0].body.p_post, false, field);
});
test("older backends without the bundle table still load ordinary plans", async () => {
  status = 404;
  response = { code: "PGRST205", message: "Table unavailable" };
  assert.equal(await api.getPlanOfferBundle("ordinary-plan"), null);
  assert.deepEqual(await api.listBookingPlanBundles(["ordinary-booking"]), []);
});
test("network and permission errors are not disguised as a plan with no reservation", async () => {
  status = 403;
  response = { code: "42501", message: "Denied" };
  await assert.rejects(api.getPlanOfferBundle("plan"), /retry before joining/);
});
test("booking metadata uses bounded batches and never asks for private retry payloads", async () => {
  response = [];
  await api.listBookingPlanBundles(
    Array.from({ length: 205 }, (_, i) => `booking-${i}`),
  );
  assert.equal(calls.length, 3);
  assert.ok(
    calls.every(
      (call) =>
        !call.url.searchParams.get("select")?.includes("request_payload"),
    ),
  );
});
