import { test } from "node:test";
import assert from "node:assert/strict";
import { discoverOffers, offerCategory } from "../src/utils/offerDiscovery";
import type { Offer } from "../src/services/mappers";
const now = new Date("2026-11-13T10:00:00Z");
const offer = (
  id: string,
  title: string,
  patch: Partial<Offer> = {},
): Offer => ({
  id,
  title,
  description: "A local opening",
  businessId: "b1",
  businessName: "Neighbourhood business",
  startsAt: "2026-11-13T09:00:00Z",
  endsAt: "2026-11-14T10:00:00Z",
  slotCapacity: 2,
  redemptions: 0,
  status: "live",
  isSpotlight: false,
  createdAt: now.toISOString(),
  ...patch,
});
test("offer categories filter published business copy and keep unclassified offers visible under All", () => {
  const offers = [
    offer("gym", "Gym training session"),
    offer("court", "Book a badminton court"),
    offer("cafe", "Coffee and cake", { businessName: "Loaf Café" }),
    offer("spa", "Time for a massage"),
    offer("other", "A local opening"),
  ];
  assert.deepEqual(offers.map(offerCategory), [
    "fitness",
    "sports",
    "food",
    "wellness",
    "all",
  ]);
  for (const [category, id] of [
    ["fitness", "gym"],
    ["sports", "court"],
    ["food", "cafe"],
    ["wellness", "spa"],
  ] as const)
    assert.deepEqual(
      discoverOffers(offers, category, now).map((o) => o.id),
      [id],
    );
  assert.equal(discoverOffers(offers, "all", now).length, 5);
  assert.equal(offers.length, 5);
});
test("offer carousel excludes drafts, expired offers and exhausted redemptions, retaining genuine free offers", () => {
  const offers = [
    offer("free", "Gym trial", { priceCents: 0 }),
    offer("draft", "Gym trial", { status: "draft" }),
    offer("ended", "Gym trial", { endsAt: now.toISOString() }),
    offer("invalid", "Gym trial", { endsAt: "invalid" }),
    offer("sold-out", "Gym trial", { maxRedemptions: 2, redemptions: 2 }),
  ];
  assert.deepEqual(
    discoverOffers(offers, "all", now).map((o) => o.id),
    ["free"],
  );
});
