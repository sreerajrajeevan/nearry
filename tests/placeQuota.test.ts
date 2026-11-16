import test from "node:test";
import assert from "node:assert/strict";
import { createGooglePlacesProvider } from "../supabase/functions/_shared/googlePlaces";
import {
  QUOTA_MESSAGE,
  createPlaceAutocompleteHandler,
} from "../supabase/functions/_shared/placeAutocompleteHandler";
import { withSearchFallback } from "../supabase/functions/_shared/placeFallback";
import { placeSearchError } from "../src/services/places";
import type { PlaceSuggestion } from "../supabase/functions/_shared/placeTypes";

const req = (body: unknown) =>
  new Request("https://nearry.test/place-autocomplete", {
    method: "POST",
    headers: { authorization: "Bearer valid" },
    body: JSON.stringify(body),
  });
const quotaGoogle = (counter: { n: number }) =>
  createGooglePlacesProvider("key", (async () => {
    counter.n++;
    return Response.json(
      { error: { status: "RESOURCE_EXHAUSTED" } },
      { status: 429 },
    );
  }) as typeof fetch);
const kochi: PlaceSuggestion = {
  provider: "geoapify",
  id: "geo-kochi",
  name: "Kochi",
  address: "Kerala, India",
  latitude: 9.93,
  longitude: 76.26,
  attributions: [{ label: "© OpenStreetMap contributors" }],
} as PlaceSuggestion;

const quiet = async (fn: () => Promise<void>) => {
  const log = console.error;
  console.error = () => {};
  try {
    await fn();
  } finally {
    console.error = log;
  }
};

test("a used-up Google quota says so, and is not retried", () =>
  quiet(async () => {
    const counter = { n: 0 };
    const handler = createPlaceAutocompleteHandler({
      provider: quotaGoogle(counter),
      authenticate: async () => "user",
      reserve: async () => true,
    });
    const response = await handler(req({ query: "Bangalore" }));
    assert.equal(response.status, 429);
    assert.equal((await response.json()).error, QUOTA_MESSAGE);
    assert.equal(counter.n, 1);
    // The phone doesn't retry it either, and shows the message as is.
    const shown = await placeSearchError({
      name: "FunctionsHttpError",
      context: { status: 429, json: async () => ({ error: QUOTA_MESSAGE }) },
    });
    assert.equal(shown.retryable, false);
    assert.equal(shown.message, QUOTA_MESSAGE);
  }));

test("with a backup configured, search keeps working when Google is out", () =>
  quiet(async () => {
    const counter = { n: 0 };
    let backupCalls = 0;
    const provider = withSearchFallback(quotaGoogle(counter), async () => {
      backupCalls++;
      return [kochi];
    });
    const handler = createPlaceAutocompleteHandler({
      provider,
      authenticate: async () => "user",
      reserve: async () => true,
    });
    const response = await handler(req({ query: "Kochi" }));
    assert.equal(response.status, 200);
    const { places } = await response.json();
    assert.equal(places[0].name, "Kochi");
    assert.equal(places[0].latitude, 9.93);
    assert.equal(backupCalls, 1);
  }));

test("a rejected request is not sent to the backup", () =>
  quiet(async () => {
    let backupCalls = 0;
    const rejecting = createGooglePlacesProvider("key", (async () =>
      Response.json(
        { error: { status: "INVALID_ARGUMENT" } },
        { status: 400 },
      )) as typeof fetch);
    const provider = withSearchFallback(rejecting, async () => {
      backupCalls++;
      return [kochi];
    });
    await assert.rejects(provider.suggest("Kochi"));
    assert.equal(backupCalls, 0);
  }));
