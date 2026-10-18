import test from "node:test";
import assert from "node:assert/strict";
import { postCategory, venueCategory } from "../src/utils/discovery";
import { businessDay } from "../src/utils/businessDay";
import type { Booking, Offer } from "../src/services/mappers";

const booking = (
  slot: Date,
  status: Booking["status"] = "pending",
): Booking => ({
  id: slot.toISOString(),
  offerId: "offer",
  customerId: "customer",
  customerName: "Neighbour",
  offerTitle: "Haircut",
  slot: slot.toISOString(),
  partySize: 1,
  status,
  createdAt: slot.toISOString(),
});
const offer = (status: Offer["status"], end: Date): Offer => ({
  id: status,
  businessId: "business",
  businessName: "Studio",
  title: "Haircut",
  description: "",
  slotCapacity: 1,
  redemptions: 0,
  status,
  startsAt: new Date(2026, 11, 31, 9).toISOString(),
  endsAt: end.toISOString(),
  createdAt: end.toISOString(),
});

test("discovery separates sports, company, and exploration using words rather than substrings", () => {
  assert.equal(postCategory({ title: "Football at 8?", tags: [] }), "Play");
  assert.equal(
    postCategory({ title: "Company after work?", tags: ["coffee"] }),
    "Meet",
  );
  assert.equal(
    postCategory({ title: "A sunset paddle", tags: ["outdoors"] }),
    "Explore",
  );
  assert.equal(
    postCategory({ title: "A runway art exhibition", tags: [] }),
    "Explore",
  );
  assert.equal(
    venueCategory({ name: "Unity Turf", category: "Sports" }),
    "Play",
  );
  assert.equal(venueCategory({ name: "Loaf Café", category: "Café" }), "Meet");
  assert.equal(postCategory({ title: "Chaya after work?", tags: [] }), "Meet");
  assert.equal(
    postCategory({ title: "A haircut opening", tags: [] }),
    "Unwind",
  );
  assert.equal(
    venueCategory({ name: "Studio Nine", category: "Salon" }),
    "Unwind",
  );
  assert.equal(
    postCategory({ title: "A spacious art studio", tags: [] }),
    "Explore",
  );
});

test("bookings today excludes cancellations and tomorrow, includes the whole local day at a year boundary", () => {
  const now = new Date(2026, 11, 31, 15);
  const morning = booking(new Date(2026, 11, 31, 9), "confirmed");
  const night = booking(new Date(2026, 11, 31, 23, 59));
  const result = businessDay(
    [
      night,
      booking(new Date(2027, 0, 1)),
      booking(new Date(2026, 11, 30, 23, 59)),
      morning,
      booking(new Date(2026, 11, 31, 12), "cancelled"),
    ],
    [],
    now,
  );
  assert.deepEqual(result.today, [morning, night]);
});

test("dashboard only counts unexpired live offers and keeps drafts separate", () => {
  const now = new Date(2026, 11, 31, 15);
  const future = new Date(2027, 0, 1);
  const active = offer("live", future);
  const draft = offer("draft", future);
  const result = businessDay(
    [],
    [active, offer("live", now), offer("cancelled", future), draft],
    now,
  );
  assert.deepEqual(result.liveOffers, [active]);
  assert.deepEqual(result.drafts, [draft]);
});
