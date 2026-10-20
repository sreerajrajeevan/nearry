import type { MyJoinRequest } from "../services/joinRequests";
import type { Booking } from "../services/mappers";
import { bookingState } from "./flowState";

/** Keep ended requests out of upcoming plans, even before the server's expiry sweep. */
export function requestPresentation(request: MyJoinRequest, now = Date.now()) {
  const starts = request.postStartsAt ? Date.parse(request.postStartsAt) : NaN;
  const ended = Number.isFinite(starts) && starts <= now;
  const cancelled = request.postStatus === "cancelled";
  const unavailable = !request.postStatus && !Number.isFinite(starts);
  const terminal = ["declined", "withdrawn", "full"].includes(request.status);
  const history = cancelled || ended || unavailable || terminal;
  const canWithdraw = request.status === "pending" && !history;
  const canLeave = request.status === "approved" && !history && starts > now;
  let label: string;
  let hint: string;
  if (cancelled) {
    label = "Plan cancelled";
    hint = "The host cancelled this plan.";
  } else if (unavailable) {
    label = "Plan unavailable";
    hint = "This plan's details are no longer available.";
  } else if (request.status === "withdrawn") {
    label = "Withdrawn";
    hint = "You left this plan or withdrew your request.";
  } else if (request.status === "declined") {
    label = "Not accepted";
    hint = "The host didn't accept your request.";
  } else if (request.status === "full") {
    label = "No spots left";
    hint = "This plan filled up before you could join.";
  } else if (ended) {
    label = "Past plan";
    hint =
      request.status === "approved"
        ? "You were on the guest list."
        : "The plan started before your request was approved.";
  } else if (request.status === "approved") {
    label = "You're going";
    hint = "The host accepted your request. See the post for details.";
  } else {
    label = "Waiting for host";
    hint = "Your request was sent. The host will review it.";
  }
  return { label, hint, history, canWithdraw, canLeave };
}

export function bookingPresentation(booking: Booking, now = Date.now()) {
  const state = bookingState(booking, now);
  const past = Date.parse(booking.slot) <= now;
  return {
    ...state,
    history: past || state.expired || booking.status === "cancelled",
    label:
      past && booking.status === "confirmed" ? "Past booking" : state.label,
    hint: state.expired
      ? "The confirmation window ended. This booking is no longer active."
      : booking.status === "cancelled"
        ? "This booking was cancelled."
        : past
          ? "This booking's time has passed."
          : booking.status === "confirmed"
            ? "Your place is confirmed. Message the business with any questions."
            : "Waiting for the business to confirm your booking.",
  };
}
