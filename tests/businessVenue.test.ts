import test from "node:test";
import assert from "node:assert/strict";
import {
  businessVenueError,
  BusinessVenueSubmission,
} from "../src/utils/businessVenue";
const venue: BusinessVenueSubmission = {
  name: "Park Café",
  category: "Café",
  area: "Kakkanad",
  address: "12 Park Road, Kakkanad, Kochi 682030",
  latitude: 10.01,
  longitude: 76.35,
  source: "device",
};
test("business verification needs a full public address and finite exact coordinates", () => {
  assert.equal(businessVenueError(venue), null);
  for (const patch of [
    { address: "" },
    { name: " " },
    { category: "" },
    { area: "" },
    { latitude: NaN },
    { longitude: Infinity },
    { latitude: 91 },
    { longitude: -181 },
  ]) {
    assert.ok(businessVenueError({ ...venue, ...patch }));
  }
  assert.equal(businessVenueError({ ...venue, source: "manual" }), null);
  assert.ok(businessVenueError({ ...venue, source: "google" } as any));
});
