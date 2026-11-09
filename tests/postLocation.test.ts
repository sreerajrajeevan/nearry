import test from "node:test";
import assert from "node:assert/strict";
import {
  manualPostLocation,
  validPostLocation,
  postLocationPatch,
} from "../src/utils/postLocation";
import { toNeedPost, DbPost } from "../src/services/mappers";
import { planDistance, discoveryPlans } from "../src/utils/planDiscovery";

test("manual meeting spots require an actual coordinate pair, including valid zero and negative values", () => {
  assert.equal(manualPostLocation("", "76"), null);
  assert.equal(manualPostLocation("10", ""), null);
  for (const invalid of ["91", "NaN", "Infinity", "0x10", "10, 20"])
    assert.equal(manualPostLocation(invalid, "76"), null);
  assert.equal(manualPostLocation("10", "181"), null);
  assert.deepEqual(manualPostLocation("0", "-76.25"), {
    latitude: 0,
    longitude: -76.25,
    source: "manual",
  });
  assert.equal(
    validPostLocation({ latitude: 10, longitude: 76, source: "google" }),
    false,
  );
  assert.throws(() =>
    postLocationPatch({ latitude: 91, longitude: 0, source: "manual" }),
  );
});

test("external locations survive read mapping, expire Google coordinates, and supply distance without a venue UUID", () => {
  const row: DbPost = {
    id: "external",
    author_id: "host",
    title: "A nearby plan",
    description: "Meeting with friends",
    venue_id: null,
    venue_name: "My meeting spot",
    starts_at: new Date(Date.now() + 3600000).toISOString(),
    expires_at: null,
    vacancies: 3,
    cost_cents: 0,
    tags: [],
    status: "open",
    created_at: new Date().toISOString(),
    location_lat: 10,
    location_lng: 76,
    location_source: "google",
    location_place_id: "google-place",
    location_cached_at: new Date().toISOString(),
    distance_km: 1.2,
  };
  const post = toNeedPost(row);
  assert.equal(post.venueId, undefined);
  assert.equal(post.location?.placeId, "google-place");
  assert.equal(planDistance(post), 1.2);
  assert.equal(
    discoveryPlans([post], {
      date: "all",
      category: null,
      freeOnly: false,
      maxDistanceKm: 2,
    }).length,
    1,
  );
  assert.equal(
    discoveryPlans([post], {
      date: "all",
      category: null,
      freeOnly: false,
      maxDistanceKm: 1,
    }).length,
    0,
  );
  assert.equal(
    toNeedPost({
      ...row,
      location_cached_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    }).location,
    undefined,
  );
  assert.equal(
    toNeedPost({ ...row, location_source: "manual", location_cached_at: null })
      .location?.latitude,
    10,
  );
});
