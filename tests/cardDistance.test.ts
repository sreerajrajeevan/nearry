import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { cardDistance, validCoordinates } from "../src/utils/cardDistance";
import { distanceKm } from "../src/services/locationDistance";

const point = { latitude: 10, longitude: 76 };
const destination = { latitude: 10.022, longitude: 76 };
test("card distance uses current coordinates instead of a searched-area estimate", () => {
  const result = cardDistance({ kind: "device", point }, destination, {
    km: 42,
    origin: { kind: "area", label: "Kakkanad" },
  })!;
  assert.ok(Math.abs(result.km - 2.446) < 0.01);
  assert.equal(result.label, "About 2.4 km away");
});
test("without GPS the area name is explicit, and saved GPS is never called current", () => {
  assert.equal(
    cardDistance({ kind: "area", point, label: "Kakkanad" }, destination)
      ?.label,
    "About 2.4 km from Kakkanad",
  );
  assert.equal(
    cardDistance({ kind: "saved", point }, destination)?.label,
    "About 2.4 km from last location",
  );
});
test("a query-distance fallback keeps its own origin even if the viewer has moved", () => {
  const result = cardDistance({ kind: "device", point }, undefined, {
    km: 4.2,
    origin: { kind: "area", label: "Fort Kochi" },
  });
  assert.equal(result?.label, "About 4.2 km from Fort Kochi");
  assert.equal(cardDistance(null, undefined, { km: 4.2 }), undefined);
});
test("sample distances are labelled as samples and never use the device coordinates", () => {
  assert.equal(
    cardDistance({ kind: "sample", point }, destination, {
      km: 1.2,
      origin: { kind: "sample" },
    })?.label,
    "Sample distance · 1.2 km",
  );
  assert.equal(cardDistance({ kind: "sample", point }, destination), undefined);
});
test("missing or invalid coordinates never render zero, negative or NaN distances", () => {
  for (const bad of [
    null,
    {},
    { latitude: NaN, longitude: 0 },
    { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: Infinity },
    { latitude: "10", longitude: 76 },
  ])
    assert.equal(validCoordinates(bad), false);
  for (const km of [NaN, Infinity, -1])
    assert.equal(
      cardDistance(null, undefined, { km, origin: { kind: "area" } }),
      undefined,
    );
  assert.equal(cardDistance(null, destination), undefined);
  assert.equal(cardDistance({ kind: "device", point }), undefined);
});
test("zero and equator coordinates are valid and genuinely close plans read as nearby", () => {
  const zero = { latitude: 0, longitude: 0 };
  assert.equal(validCoordinates(zero), true);
  assert.equal(
    cardDistance({ kind: "device", point: zero }, zero)?.label,
    "Nearby · under 50 m away",
  );
});
test("distance is stable for antipodes and across the date line", () => {
  assert.ok(
    Number.isFinite(
      distanceKm(
        { latitude: 10, longitude: 20 },
        { latitude: -10, longitude: -160 },
      ),
    ),
  );
  assert.ok(
    distanceKm(
      { latitude: 0, longitude: 179.999 },
      { latitude: 0, longitude: -179.999 },
    ) < 0.3,
  );
});

const originalFetch = globalThis.fetch;
const calls: URL[] = [];
let status = 200,
  payload: unknown = [];
let lookup: typeof import("../src/services/venueDestinations");
before(async () => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://distance-test.invalid";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-only";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(
      new URL(
        typeof input === "string" || input instanceof URL ? input : input.url,
      ),
    );
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  lookup = await import("../src/services/venueDestinations");
});
beforeEach(() => {
  calls.length = 0;
  status = 200;
  payload = [];
});
after(() => {
  globalThis.fetch = originalFetch;
});
test("public venue lookup deduplicates IDs, bounds batches, and sends no viewer coordinates", async () => {
  await lookup.venueDestinations([
    ...Array.from({ length: 205 }, (_, i) => `venue-${i}`),
    "venue-1",
  ]);
  assert.equal(calls.length, 3);
  assert.ok(
    calls.every(
      (url) =>
        url.searchParams.get("select") === "id,name,location_lat,location_lng",
    ),
  );
  assert.ok(
    calls.every(
      (url) => !url.searchParams.has("p_lat") && !url.searchParams.has("p_lng"),
    ),
  );
});
test("missing venue coordinates stay unknown and malformed rows do not hide valid points", async () => {
  payload = [
    null,
    { id: "known", name: "Court", location_lat: 0, location_lng: 0 },
    {
      id: "unknown",
      name: "Legacy place",
      location_lat: null,
      location_lng: null,
    },
  ];
  const result = await lookup.venueDestinations(["known", "unknown"]);
  assert.deepEqual(result.get("known")?.point, { latitude: 0, longitude: 0 });
  assert.equal(result.get("unknown")?.point, undefined);
});
test("a denied venue lookup rejects safely and empty lists make no request", async () => {
  assert.equal((await lookup.venueDestinations([])).size, 0);
  assert.equal(calls.length, 0);
  status = 403;
  payload = { message: "Denied", code: "42501" };
  await assert.rejects(lookup.venueDestinations(["venue"]), /Denied/);
});
