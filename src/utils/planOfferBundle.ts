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
    (!bundle.holdExpiresAt || Date.parse(bundle.holdExpiresAt) <= now)
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

export { formatRupees as rupees } from "./offerPrice";
