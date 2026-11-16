import test from "node:test";
import assert from "node:assert/strict";
import { createGooglePlacesProvider } from "../supabase/functions/_shared/googlePlaces";
import { placeSearchError } from "../src/services/places";

const ok = () =>
  Response.json({
    suggestions: [
      {
        placePrediction: {
          placeId: "ChIJ-kannur",
          types: ["locality", "political"],
          structuredFormat: {
            mainText: { text: "Kannur" },
            secondaryText: { text: "Kerala, India" },
          },
        },
      },
    ],
  });

test("Google only ever gets coordinates as the search centre", async () => {
  let sent: any;
  const provider = createGooglePlacesProvider("key", (async (_url, init) => {
    sent = JSON.parse(String(init!.body));
    return ok();
  }) as typeof fetch);
  // An onboarding area carries a label and source; Google rejects those.
  const area = {
    latitude: 12.97,
    longitude: 77.59,
    label: "Bengaluru",
    source: "google",
    acquiredAt: "2026-11-01T00:00:00Z",
  };
  await provider.suggest("Kannur", area as any);
  assert.deepEqual(sent.locationBias.circle.center, {
    latitude: 12.97,
    longitude: 77.59,
  });
});

test("a passing Google failure is retried once; a rejected request is not", async () => {
  const quiet = console.error;
  console.error = () => {};
  try {
    let calls = 0;
    const flaky = createGooglePlacesProvider("key", (async () =>
      ++calls === 1
        ? new Response("{}", { status: 503 })
        : ok()) as typeof fetch);
    const [place] = await flaky.suggest("Kannur");
    assert.equal(place.name, "Kannur");
    assert.equal(calls, 2);

    let rejected = 0;
    const bad = createGooglePlacesProvider("key", (async () => {
      rejected++;
      return Response.json(
        { error: { status: "INVALID_ARGUMENT" } },
        { status: 400 },
      );
    }) as typeof fetch);
    await assert.rejects(bad.suggest("Kannur"));
    assert.equal(rejected, 1);
  } finally {
    console.error = quiet;
  }
});

test("no signal and server trouble say so and are retried; limits are not", async () => {
  const offline = await placeSearchError({ name: "FunctionsFetchError" });
  assert.match(offline.message, /internet/);
  assert.equal(offline.retryable, true);
  const server = await placeSearchError({
    name: "FunctionsHttpError",
    context: {
      status: 502,
      json: async () => ({
        error: "Could not search places. Please try again.",
      }),
    },
  });
  assert.equal(server.retryable, true);
  const busy = await placeSearchError({
    name: "FunctionsHttpError",
    context: {
      status: 429,
      json: async () => ({
        error: "Place search is busy. Please wait a moment and try again.",
      }),
    },
  });
  assert.equal(busy.retryable, false);
  assert.match(busy.message, /busy/);
});
