import type { Booking, JoinRequest } from "../services/mappers";

export type MyPlanStatus = "pending" | "approved";

/**
 * My current status per plan, from my requests newest first. Only a pending
 * or approved latest request counts; after a decline or withdrawal the card
 * offers Join again.
 */
export function myRequestStatuses(
  requests: Pick<JoinRequest, "postId" | "status">[],
): Map<string, MyPlanStatus> {
  const latest = new Map<string, JoinRequest["status"]>();
  for (const r of requests)
    if (!latest.has(r.postId)) latest.set(r.postId, r.status);
  const result = new Map<string, MyPlanStatus>();
  for (const [postId, status] of latest)
    if (status === "pending" || status === "approved")
      result.set(postId, status);
  return result;
}

export type MyOfferStatus = "requested" | "booked";

/**
 * My status per offer from my bookings: "booked" if any upcoming booking is
 * confirmed, else "requested" while a request is still waiting. Expired,
 * past and cancelled bookings don't count.
 */
export function myOfferStatuses(
  bookings: Pick<Booking, "offerId" | "status" | "slot" | "holdExpiresAt">[],
  now = new Date(),
): Map<string, MyOfferStatus> {
  const result = new Map<string, MyOfferStatus>();
  for (const b of bookings) {
    if (new Date(b.slot).getTime() <= now.getTime()) continue;
    if (b.status === "confirmed") result.set(b.offerId, "booked");
    else if (
      b.status === "pending" &&
      (!b.holdExpiresAt ||
        new Date(b.holdExpiresAt).getTime() > now.getTime()) &&
      !result.has(b.offerId)
    )
      result.set(b.offerId, "requested");
  }
  return result;
}

/** Server statuses with this phone's instant ones on top (null removes). */
export function withMarks(
  statuses: ReadonlyMap<string, MyPlanStatus>,
  marks: ReadonlyMap<string, MyPlanStatus | null>,
): ReadonlyMap<string, MyPlanStatus> {
  if (!marks.size) return statuses;
  const next = new Map(statuses);
  for (const [id, status] of marks)
    if (status) next.set(id, status);
    else next.delete(id);
  return next;
}
