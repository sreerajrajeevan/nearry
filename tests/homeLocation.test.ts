import test from "node:test";
import assert from "node:assert/strict";
import {
  HOME_DISTANCES,
  defaultDistance,
  homeLocationKey,
  parseHomeLocation,
  placeKind,
  rememberPlace,
  widenDistance,
} from "../src/utils/homeLocation";
import {
  googlePlaceKind,
  mapGooglePredictions,
} from "../supabase/functions/_shared/googlePlaces";
import {
  validPlace,
  validSuggestion,
} from "../supabase/functions/_shared/placeTypes";

const bengaluru = {
  provider: "google",
  id: "ChIJbU60yXAWrjsR4E9-UejD3_g",
  name: "Bengaluru",
  address: "Bengaluru, Karnataka, India",
  latitude: 12.9716,
  longitude: 77.5946,
  attributions: [{ label: "Google Maps", url: "https://maps.google.com/" }],
};
const now = Date.parse("2026-11-16T10:00:00Z");

test("a searched city starts wide, an area mid-way and a single spot close", () => {
  assert.equal(placeKind(bengaluru), "city");
  assert.equal(
    placeKind({
      name: "Koramangala",
      address: "Koramangala, Bengaluru, Karnataka, India",
    }),
    "area",
  );
  assert.equal(
    placeKind({
      name: "Third Wave Coffee",
      address: "80 Feet Rd, Koramangala, Bengaluru, Karnataka 560034, India",
    }),
    "spot",
  );
  // The provider's answer wins over the address guess.
  assert.equal(placeKind({ ...bengaluru, kind: "area" }), "area");
  assert.equal(defaultDistance("city"), 25);
  assert.equal(defaultDistance("area"), 5);
  assert.equal(defaultDistance("spot"), 2);
  assert.equal(defaultDistance("me"), 5);
  for (const kind of ["city", "area", "spot", "me"] as const)
    assert.ok(HOME_DISTANCES.includes(defaultDistance(kind)));
});

test("Home widens step by step only when nothing is close, and says so", () => {
  const plansAt = [7, 18]; // km from the chosen place
  const count = (km: number) => plansAt.filter((d) => d <= km).length;
  assert.deepEqual(widenDistance(5, count), { distanceKm: 10, widened: true });
  assert.deepEqual(widenDistance(25, count), {
    distanceKm: 25,
    widened: false,
  });
  assert.deepEqual(
    widenDistance(2, () => 0),
    {
      distanceKm: 2,
      widened: false,
    },
  );
  assert.deepEqual(
    widenDistance(5, (km) => (km >= 50 ? 1 : 0)),
    { distanceKm: 50, widened: true },
  );
});

test("the remembered location survives a restart but not past Google's limit", () => {
  const recents = rememberPlace([], bengaluru, new Date(now));
  const saved = JSON.stringify({
    current: { type: "place", place: recents[0] },
    distanceKm: 25,
    recents,
  });
  const restored = parseHomeLocation(saved, now + 86400000);
  assert.equal(restored.current?.type, "place");
  assert.equal(restored.distanceKm, 25);
  assert.equal(restored.recents[0].kind, "city");
  const stale = parseHomeLocation(saved, now + 30 * 86400000);
  assert.equal(stale.current, null);
  assert.equal(stale.distanceKm, null);
  assert.deepEqual(stale.recents, []);
  assert.deepEqual(parseHomeLocation("not json", now).recents, []);
  assert.equal(
    parseHomeLocation(
      JSON.stringify({ current: { type: "me", latitude: 200 }, distanceKm: 5 }),
      now,
    ).current,
    null,
  );
  assert.equal(
    parseHomeLocation(
      JSON.stringify({
        current: { type: "place", place: recents[0] },
        distanceKm: 7,
      }),
      now,
    ).distanceKm,
    null,
  );
  assert.equal(homeLocationKey("u1"), "nearry.home-location.v1:u1");
});

test("recent places are newest first, without repeats, and short", () => {
  let recents = rememberPlace([], bengaluru, new Date(now));
  for (let i = 0; i < 5; i++)
    recents = rememberPlace(
      recents,
      { ...bengaluru, id: `place-${i}`, name: `Place ${i}` },
      new Date(now),
    );
  recents = rememberPlace(
    recents,
    { ...bengaluru, id: "place-2" },
    new Date(now),
  );
  assert.equal(recents.length, 4);
  assert.equal(recents[0].id, "place-2");
  assert.equal(new Set(recents.map((p) => p.id)).size, 4);
});

test("Google place types tell a city from an area or a café", () => {
  assert.equal(googlePlaceKind(["locality", "political"]), "city");
  assert.equal(
    googlePlaceKind(["sublocality_level_1", "sublocality", "political"]),
    "area",
  );
  assert.equal(
    googlePlaceKind(["cafe", "food", "point_of_interest", "establishment"]),
    "spot",
  );
  assert.equal(googlePlaceKind(undefined), undefined);
  const [city] = mapGooglePredictions({
    suggestions: [
      {
        placePrediction: {
          placeId: "ChIJbU60yXAWrjsR4E9-UejD3_g",
          types: ["locality", "political"],
          structuredFormat: {
            mainText: { text: "Bengaluru" },
            secondaryText: { text: "Karnataka, India" },
          },
        },
      },
    ],
  });
  assert.equal(city.kind, "city");
  assert.ok(validSuggestion(city));
  assert.ok(validPlace({ ...bengaluru, kind: "city" }));
  assert.ok(!validPlace({ ...bengaluru, kind: "planet" }));
  assert.ok(!validSuggestion({ ...city, kind: "planet" }));
});
