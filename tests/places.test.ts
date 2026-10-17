import test from "node:test";
import assert from "node:assert/strict";
import {
  createGeoapifyProvider,
  mapGeoapifyResults,
} from "../supabase/functions/_shared/geoapifyPlaces";
import { createPlaceSearchHandler } from "../supabase/functions/_shared/placeSearchHandler";
import type {
  Place,
  PlaceProvider,
} from "../supabase/functions/_shared/placeTypes";
const result = {
  place_id: "opaque-geoapify-id",
  name: "Infopark",
  formatted: "Infopark, Kakkanad, Kochi",
  lat: 10.007,
  lon: 76.363,
  datasource: { attribution: "© OpenStreetMap contributors" },
};
const request = (body: unknown, token = "valid") =>
  new Request("https://nearry.test/place-search", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
test("Geoapify adapter encodes text, uses longitude/latitude bias, limits results and preserves source attribution", async () => {
  let url: URL | undefined;
  const adapter = createGeoapifyProvider("server-only-key", (async (input) => {
    url = new URL(String(input));
    return Response.json({
      results: [
        result,
        result,
        { ...result, place_id: "bad", lat: NaN },
        {
          ...result,
          place_id: "extra",
          datasource: { attribution: "Additional source" },
        },
      ],
    });
  }) as typeof fetch);
  const places = await adapter.search("Infopark & cafés", {
    latitude: 10,
    longitude: 76,
  });
  assert.equal(url!.searchParams.get("text"), "Infopark & cafés");
  assert.equal(url!.searchParams.get("filter"), "countrycode:in");
  assert.equal(url!.searchParams.get("bias"), "proximity:76,10");
  assert.equal(url!.searchParams.get("limit"), "5");
  assert.equal(places.length, 2);
  assert.equal(places[0].id, "opaque-geoapify-id");
  assert.equal(places[0].provider, "geoapify");
  assert.ok(
    places[0].attributions.some((a) => a.label === "Powered by Geoapify"),
  );
  assert.ok(
    places[1].attributions.some((a) => a.label === "Additional source"),
  );
  assert.ok(!JSON.stringify(places).includes("server-only-key"));
});
test("malformed and missing-coordinate provider rows are rejected without inventing locations", () => {
  assert.throws(() => mapGeoapifyResults({ features: [] }), /Invalid/);
  assert.deepEqual(
    mapGeoapifyResults({
      results: [
        { ...result, lat: null },
        { ...result, lon: 181 },
        { ...result, place_id: undefined },
        null,
      ],
    }),
    [],
  );
});
test("handler authenticates before provider access; invalid input and exhausted quota never call the provider", async () => {
  let calls = 0;
  const provider: PlaceProvider = {
    id: "test",
    async search() {
      calls++;
      return [];
    },
  };
  const handler = createPlaceSearchHandler({
    provider,
    authenticate: async (token) => (token === "Bearer valid" ? "user" : null),
    reserve: async () => false,
  });
  assert.equal(
    (await handler(request({ query: "Infopark" }, "bad"))).status,
    401,
  );
  assert.equal((await handler(request({ query: "ab" }))).status, 400);
  assert.equal(
    (
      await handler(
        request({ query: "Infopark", bias: { latitude: 91, longitude: 76 } }),
      )
    ).status,
    400,
  );
  assert.equal((await handler(request({ query: "Infopark" }))).status, 429);
  assert.equal(calls, 0);
  const missing = createPlaceSearchHandler({
    provider: null,
    authenticate: async () => "user",
    reserve: async () => true,
  });
  assert.equal((await missing(request({ query: "Infopark" }))).status, 503);
  const preflight = await handler(
    new Request("https://nearry.test", { method: "OPTIONS" }),
  );
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), "*");
});
test("cache expires, location bias separates searches, and raw upstream failures stay private", async () => {
  let time = 0,
    calls = 0,
    reservations = 0;
  const provider: PlaceProvider = {
    id: "test",
    async search() {
      calls++;
      return mapGeoapifyResults({ results: [result] });
    },
  };
  const handler = createPlaceSearchHandler({
    provider,
    authenticate: async () => "user",
    reserve: async () => {
      reservations++;
      return true;
    },
    now: () => time,
  });
  const first = await handler(request({ query: "Infopark" }));
  assert.equal((await first.json()).places[0].name, "Infopark");
  assert.equal(first.headers.get("Cache-Control"), "no-store");
  await handler(request({ query: "Infopark" }));
  assert.equal(calls, 1);
  assert.equal(reservations, 1);
  await handler(
    request({ query: "Infopark", bias: { latitude: 10, longitude: 76 } }),
  );
  assert.equal(calls, 2);
  time = 300001;
  await handler(request({ query: "Infopark" }));
  assert.equal(calls, 3);
  const failed = createPlaceSearchHandler({
    provider: {
      id: "broken",
      async search() {
        throw new Error("URL?apiKey=secret");
      },
    },
    authenticate: async () => "user",
    reserve: async () => true,
  });
  const error = await failed(request({ query: "Infopark" }));
  assert.equal(error.status, 502);
  assert.ok(!(await error.text()).includes("secret"));
});
test("the same handler accepts a later provider without changing the app-facing place model", async () => {
  const place: Place = {
    provider: "future-provider",
    id: "other-opaque-id",
    name: "Infopark",
    address: "Kakkanad",
    latitude: 10,
    longitude: 76,
    attributions: [],
  };
  const handler = createPlaceSearchHandler({
    provider: {
      id: "future-provider",
      async search() {
        return [place];
      },
    },
    authenticate: async () => "user",
    reserve: async () => true,
  });
  assert.deepEqual(
    (await (await handler(request({ query: "Infopark" }))).json()).places,
    [place],
  );
});
