import type { Booking, NeedPost } from "../services/mappers";

/** UI eligibility follows deadlines even before a scheduled sweep has run. */
export function postState(post: NeedPost, now = Date.now()) {
  const future = new Date(post.startsAt).getTime() > now;
  const cancelled = post.status === "cancelled";
  const accepting =
    future &&
    !cancelled &&
    post.status === "open" &&
    post.spotsLeft > 0 &&
    (!post.expiresAt || new Date(post.expiresAt).getTime() > now);
  return {
    accepting,
    canEdit: future && post.status === "open",
    canCancel: future && !cancelled,
    canLeave: future && !cancelled,
    label: cancelled
      ? "Cancelled"
      : !future
        ? "Past"
        : post.spotsLeft <= 0
          ? "Full"
          : !accepting
            ? "Requests closed"
            : "Open",
  };
}

export function bookingState(booking: Booking, now = Date.now()) {
  const future = new Date(booking.slot).getTime() > now;
  const expired =
    booking.status === "pending" &&
    (!future ||
      (!!booking.holdExpiresAt &&
        new Date(booking.holdExpiresAt).getTime() <= now));
  return {
    label: expired
      ? "Expired"
      : booking.status === "confirmed"
        ? "Confirmed"
        : booking.status === "cancelled"
          ? "Cancelled"
          : "Pending",
    expired,
    canConfirm: booking.status === "pending" && !expired,
    canCancel: future && !expired && booking.status !== "cancelled",
  };
}
