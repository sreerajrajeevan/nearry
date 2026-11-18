import type { Offer } from "../services/mappers";

export type PlanOfferBundle = {
  postId: string;
  planTitle: string;
  bookingId?: string;
  businessName: string;
  offerTitle: string;
  venueName: string;
  startsAt: string;
  endsAt: string;
  partySize: number;
  priceCents: number;
  status: "pending" | "confirmed" | "cancelled";
  holdExpiresAt?: string;
};

export function bundleStatus(bundle: PlanOfferBundle, now = Date.now()) {
  if (bundle.status === "cancelled" || !bundle.bookingId) return "cancelled";
  if (
    bundle.status === "pending" &&
    (!bundle.holdExpiresAt ||
      !Number.isFinite(Date.parse(bundle.holdExpiresAt)) ||
      Date.parse(bundle.holdExpiresAt) <= now)
  )
    return "expired";
  return bundle.status;
}

export function bundleOfferEligible(offer: Offer) {
  return (
    offer.status === "live" &&
    !!offer.venueId &&
    Number.isInteger(offer.priceCents) &&
    (offer.priceCents ?? -1) >= 0 &&
    [30, 60, 90, 120, 180, 240].includes(offer.slotMinutes ?? 60)
  );
}

/** Group plans require the entire time block, not just enough remaining seats. */
export function bundleSlotAvailable(
  value: unknown,
  people: number,
  now = Date.now(),
): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const slot = value as {
    starts_at?: unknown;
    capacity?: unknown;
    seats_left?: unknown;
  };
  return (
    Number.isInteger(people) &&
    people >= 2 &&
    people <= 50 &&
    typeof slot.starts_at === "string" &&
    Date.parse(slot.starts_at) > now + 15 * 60_000 &&
    typeof slot.capacity === "number" &&
    Number.isInteger(slot.capacity) &&
    slot.capacity >= 1 &&
    slot.capacity <= 500 &&
    slot.seats_left === slot.capacity &&
    slot.capacity >= people
  );
}

export { formatRupees as rupees } from "./offerPrice";
