import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  bundleOfferEligible,
  bundleSlotAvailable,
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

test("group slots exclude partial bookings, near-start times and groups outside reserved capacity", () => {
  const slot = {
    starts_at: new Date(now + 60 * 60_000).toISOString(),
    capacity: 5,
    seats_left: 5,
  };
  assert.equal(bundleSlotAvailable(slot, 4, now), true);
  // Four remaining seats are enough numerically, but the block is no longer exclusive.
  assert.equal(bundleSlotAvailable({ ...slot, seats_left: 4 }, 4, now), false);
  assert.equal(bundleSlotAvailable(slot, 6, now), false);
  assert.equal(bundleSlotAvailable(slot, 2, now), true);
  assert.equal(
    bundleSlotAvailable({ ...slot, capacity: 50, seats_left: 50 }, 50, now),
    true,
  );
  for (const people of [1, 51, 2.5])
    assert.equal(
      bundleSlotAvailable(
        { ...slot, capacity: 100, seats_left: 100 },
        people,
        now,
      ),
      false,
    );
  assert.equal(
    bundleSlotAvailable(
      { ...slot, starts_at: new Date(now + 15 * 60_000).toISOString() },
      4,
      now,
    ),
    false,
  );
  assert.equal(
    bundleSlotAvailable(
      { ...slot, starts_at: new Date(now - 60_000).toISOString() },
      4,
      now,
    ),
    false,
  );
});

const originalFetch = globalThis.fetch;
const calls: { url: URL; body: any }[] = [];
let response: any = null;
let status = 200;
let networkFailure = false;
let replies: { data: unknown; status?: number }[] = [];
let bookingsApi: typeof import("../src/services/bookings");
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
    if (networkFailure) throw new TypeError("Network request failed");
    const reply = replies.shift() ?? { data: response, status };
    return new Response(JSON.stringify(reply.data), {
      status: reply.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  api = await import("../src/services/planOfferBundles");
  bookingsApi = await import("../src/services/bookings");
});
beforeEach(() => {
  calls.length = 0;
  response = null;
  status = 200;
  networkFailure = false;
  replies = [];
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

const validRow = {
  post_id: "plan",
  plan_title: "Badminton",
  booking_id: "booking",
  business_name: "Arena",
  offer_title: "Court offer",
  venue_name: "Arena Court 1",
  starts_at: bundle.startsAt,
  ends_at: bundle.endsAt,
  party_size: 4,
  price_cents: 15000,
  status: "pending",
  hold_expires_at: bundle.holdExpiresAt,
};

test("reservation responses reject malformed fields before they reach render", async () => {
  response = validRow;
  assert.equal(
    (await api.getPlanOfferBundle("plan"))?.offerTitle,
    "Court offer",
  );
  for (const bad of [
    {},
    { ...validRow, business_name: { private: "bad" } },
    { ...validRow, status: "unknown" },
    { ...validRow, starts_at: "not-a-date" },
    { ...validRow, ends_at: validRow.starts_at },
    { ...validRow, party_size: 0 },
    { ...validRow, party_size: 51 },
    { ...validRow, price_cents: -1 },
    { ...validRow, price_cents: 25_000_001 },
    { ...validRow, booking_id: {} },
    { ...validRow, hold_expires_at: "not-a-date" },
  ]) {
    response = bad;
    await assert.rejects(api.getPlanOfferBundle("plan"), /reservation.*retry/i);
  }
  response = [];
  assert.equal(await api.getPlanOfferBundle("ordinary-plan"), null);
  response = {
    ...validRow,
    status: "cancelled",
    booking_id: null,
    hold_expires_at: null,
  };
  assert.equal(
    bundleStatus((await api.getPlanOfferBundle("plan"))!),
    "cancelled",
  );
});

test("slot responses reject invalid lists, missing rows and impossible capacity before rendering", async () => {
  const slot = {
    id: "slot",
    starts_at: bundle.startsAt,
    ends_at: bundle.endsAt,
    capacity: 5,
    seats_left: 5,
  };
  response = [slot];
  assert.deepEqual(await bookingsApi.listOfferSlots("offer"), [slot]);
  for (const bad of [
    { rows: [slot] },
    [null],
    [{}],
    [{ ...slot, capacity: -1 }],
    [{ ...slot, seats_left: 6 }],
    [{ ...slot, seats_left: 1.5 }],
    [{ ...slot, starts_at: "broken" }],
    [{ ...slot, ends_at: slot.starts_at }],
  ]) {
    response = bad;
    await assert.rejects(bookingsApi.listOfferSlots("offer"), /slots.*retry/i);
  }
  response = [];
  assert.deepEqual(await bookingsApi.listOfferSlots("offer"), []);
});

test("unexpected publication responses cannot become invalid navigation IDs", async () => {
  const input = {
    title: "Badminton",
    description: "A friendly group game",
    startsAt: bundle.startsAt,
    vacancies: 3,
    tags: [],
  };
  for (const data of [
    null,
    {},
    { post_id: {} },
    { post_id: [] },
    { post_id: "" },
    { post_id: 42 },
  ]) {
    response = data;
    await assert.rejects(
      api.createPlanOfferBundle("slot", input, "retry-key", 15000),
      /Retry to check the same request/,
    );
  }
});

test("a lost response and service outage can retry the same publication key", async () => {
  const input = {
    title: "Badminton",
    description: "A friendly group game",
    startsAt: bundle.startsAt,
    vacancies: 3,
    tags: [],
  };
  networkFailure = true;
  await assert.rejects(
    api.createPlanOfferBundle("slot", input, "same-request", 15000),
  );
  networkFailure = false;
  status = 503;
  response = { message: "Temporarily unavailable" };
  await assert.rejects(
    api.createPlanOfferBundle("slot", input, "same-request", 15000),
  );
  status = 200;
  response = { post_id: "saved-plan", booking_id: "saved-booking" };
  assert.equal(
    await api.createPlanOfferBundle("slot", input, "same-request", 15000),
    "saved-plan",
  );
  assert.ok(calls.every((call) => call.body.p_client_key === "same-request"));
});

test("a failed metadata batch returns an error rather than partial reservation context", async () => {
  replies = [
    { data: [validRow] },
    { data: { code: "42501", message: "Denied" }, status: 403 },
  ];
  await assert.rejects(
    api.listBookingPlanBundles(
      Array.from({ length: 101 }, (_, i) => `booking-${i}`),
    ),
    /Denied/,
  );
  assert.equal(calls.length, 2);
  response = [null];
  await assert.rejects(
    api.listBookingPlanBundles(["booking"]),
    /reservation.*retry/i,
  );
});

test("invalid hold times and malformed slots fail closed instead of throwing during render", () => {
  assert.equal(
    bundleStatus({ ...bundle, holdExpiresAt: "broken" }, now),
    "expired",
  );
  for (const slot of [
    null,
    undefined,
    {},
    { starts_at: "broken", capacity: 5, seats_left: 5 },
    { starts_at: bundle.startsAt, capacity: 5.5, seats_left: 5.5 },
    { starts_at: bundle.startsAt, capacity: 0, seats_left: 0 },
  ]) {
    assert.equal(bundleSlotAvailable(slot as any, 4, now), false);
  }
});
