import test from "node:test";
import assert from "node:assert/strict";
import {
  createGooglePlacesProvider,
  mapGooglePredictions,
} from "../supabase/functions/_shared/googlePlaces";
import { createPlaceAutocompleteHandler } from "../supabase/functions/_shared/placeAutocompleteHandler";
import { validSuggestion } from "../supabase/functions/_shared/placeTypes";
const prediction = {
  placePrediction: {
    placeId: "ChIJ_test-infopark",
    text: { text: "Infopark, Kochi" },
    structuredFormat: {
      mainText: { text: "Infopark" },
      secondaryText: { text: "Kakkanad, Kochi" },
    },
  },
};
const sessionToken = "12345678-1234-4234-8234-123456789012";
const req = (body: unknown, token = "valid") =>
  new Request("https://nearry.test/place-autocomplete", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
test("Google autocomplete does one request, preserves place names and attribution, and does not prefetch details", async () => {
  const calls: { url: string; init: any }[] = [];
  const provider = createGooglePlacesProvider("private-test-key", (async (
    url,
    init,
  ) => {
    calls.push({ url: String(url), init });
    return Response.json({
      suggestions: [
        prediction,
        prediction,
        { queryPrediction: { text: { text: "not a place" } } },
      ],
    });
  }) as typeof fetch);
  const suggestions = await provider.suggest(
    "Infopark & café",
    { latitude: 10, longitude: 76 },
    sessionToken,
  );
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://places.googleapis.com/v1/places:autocomplete",
  );
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.input, "Infopark & café");
  assert.deepEqual(body.includedRegionCodes, ["in"]);
  assert.equal(body.sessionToken, sessionToken);
  assert.deepEqual(body.locationBias.circle.center, {
    latitude: 10,
    longitude: 76,
  });
  assert.equal(calls[0].init.headers["X-Goog-Api-Key"], "private-test-key");
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].name, "Infopark");
  assert.equal(suggestions[0].latitude, undefined);
  assert.equal(suggestions[0].attributions[0].label, "Google Maps");
  assert.ok(validSuggestion(suggestions[0]));
  assert.ok(!JSON.stringify(suggestions).includes("private-test-key"));
});
test("only the selected prediction fetches Essentials coordinates using the same session", async () => {
  let url: URL | undefined,
    fields = "";
  const provider = createGooglePlacesProvider("key", (async (input, init) => {
    url = new URL(String(input));
    fields = (init!.headers as any)["X-Goog-FieldMask"];
    return Response.json({
      id: prediction.placePrediction.placeId,
      formattedAddress: "Infopark, Kakkanad, Kerala",
      location: { latitude: 10.007, longitude: 76.363 },
    });
  }) as typeof fetch);
  const chosen = mapGooglePredictions({ suggestions: [prediction] })[0];
  const place = await provider.resolve(chosen, sessionToken);
  assert.equal(url!.searchParams.get("sessionToken"), sessionToken);
  assert.equal(fields, "id,location,formattedAddress,attributions");
  assert.equal(place.name, "Infopark");
  assert.equal(place.latitude, 10.007);
  assert.equal(place.provider, "google");
  assert.ok(!fields.includes("displayName"));
  assert.ok(!fields.includes("rating"));
});
test("Google empty results stay empty and malformed predictions never invent coordinates", () => {
  assert.deepEqual(mapGooglePredictions({}), []);
  assert.deepEqual(mapGooglePredictions({ suggestions: [] }), []);
  assert.deepEqual(
    mapGooglePredictions({
      suggestions: [
        null,
        { placePrediction: { placeId: "../../bad", text: { text: "bad" } } },
        { placePrediction: { placeId: "id" } },
      ],
    }),
    [],
  );
  assert.throws(() => mapGooglePredictions(null), /Invalid/);
  assert.throws(() => mapGooglePredictions({ suggestions: "bad" }), /Invalid/);
});
test("Google rejects invalid IDs and malformed coordinates on resolution", async () => {
  const chosen = mapGooglePredictions({ suggestions: [prediction] })[0];
  for (const payload of [
    {
      id: "../../bad",
      location: { latitude: 10, longitude: 76 },
      formattedAddress: "Address",
    },
    {
      id: chosen.id,
      location: { latitude: 100, longitude: 76 },
      formattedAddress: "Address",
    },
  ]) {
    const p = createGooglePlacesProvider("key", (async () =>
      Response.json(payload)) as typeof fetch);
    await assert.rejects(p.resolve(chosen), /Invalid/);
  }
});
test("authenticated two-step handler validates before quota/provider access and redacts upstream failures", async () => {
  let calls = 0,
    reservations = 0;
  const provider = {
    id: "google",
    async suggest() {
      calls++;
      return mapGooglePredictions({ suggestions: [prediction] });
    },
    async resolve() {
      calls++;
      throw new Error("key=secret billing details");
    },
  };
  const handler = createPlaceAutocompleteHandler({
    provider,
    authenticate: async (a) => (a === "Bearer valid" ? "user" : null),
    reserve: async () => {
      reservations++;
      return true;
    },
  });
  assert.equal((await handler(req({ query: "Infopark" }, "bad"))).status, 401);
  for (const body of [
    null,
    [],
    { query: "ab" },
    { query: "Infopark", bias: { latitude: 91, longitude: 0 } },
    { query: "Infopark", sessionToken: "bad" },
    { action: "resolve", place: { provider: "geoapify" } },
    { action: "unexpected", query: "Infopark" },
  ])
    assert.equal((await handler(req(body))).status, 400);
  assert.equal(calls, 0);
  assert.equal(reservations, 0);
  const response = await handler(req({ query: "Infopark", sessionToken }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const selected = (await response.json()).places[0];
  const failure = await handler(
    req({ action: "resolve", place: selected, sessionToken }),
  );
  assert.equal(failure.status, 502);
  assert.ok(!(await failure.text()).includes("secret"));
  assert.equal(reservations, 2);
});
test("suggestions are not cached across sessions, and quota exhaustion does not call Google", async () => {
  let calls = 0;
  const provider = {
    id: "google",
    async suggest() {
      calls++;
      return [];
    },
    async resolve() {
      throw Error("not called");
    },
  };
  const handler = createPlaceAutocompleteHandler({
    provider,
    authenticate: async () => "user",
    reserve: async () => true,
  });
  await handler(req({ query: "Infopark", sessionToken }));
  await handler(req({ query: "Infopark", sessionToken }));
  assert.equal(calls, 2);
  const limited = createPlaceAutocompleteHandler({
    provider,
    authenticate: async () => "user",
    reserve: async () => false,
  });
  assert.equal((await limited(req({ query: "Infopark" }))).status, 429);
  assert.equal(calls, 2);
  const missing = createPlaceAutocompleteHandler({
    provider: null,
    authenticate: async () => "user",
    reserve: async () => true,
  });
  assert.equal((await missing(req({ query: "Infopark" }))).status, 503);
});

test("Google may canonicalize a selected address ID; the authenticated handler binds it to the chosen prediction", async () => {
  const chosen = mapGooglePredictions({ suggestions: [prediction] })[0];
  const provider = createGooglePlacesProvider("key", (async () =>
    Response.json({
      id: "canonical-address-id",
      formattedAddress: "Public address",
      location: { latitude: 10, longitude: 76 },
    })) as typeof fetch);
  const handler = createPlaceAutocompleteHandler({
    provider,
    authenticate: async () => "user",
    reserve: async () => true,
  });
  const response = await handler(
    req({ action: "resolve", place: chosen, sessionToken }),
  );
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.requestedId, chosen.id);
  assert.equal(result.place.id, "canonical-address-id");
  assert.equal(result.place.name, chosen.name);
});
