import test from "node:test";
import assert from "node:assert/strict";
import {
  requestPresentation,
  bookingPresentation,
} from "../src/utils/activity";
import type { MyJoinRequest } from "../src/services/joinRequests";
import type { Booking } from "../src/services/mappers";

const now = Date.parse("2026-10-20T10:00:00Z");
const request: MyJoinRequest = {
  id: "request",
  postId: "post",
  requesterId: "person",
  requesterName: "Sree",
  status: "pending",
  declineCount: 0,
  createdAt: "2026-10-19T10:00:00Z",
  postTitle: "Evening football",
  postStatus: "open",
  postStartsAt: "2026-10-20T18:00:00Z",
};
const booking: Booking = {
  id: "booking",
  offerId: "offer",
  customerId: "person",
  customerName: "Sree",
  offerTitle: "Badminton court",
  partySize: 2,
  status: "pending",
  createdAt: "2026-10-20T09:00:00Z",
  slot: "2026-10-20T18:00:00Z",
  holdExpiresAt: "2026-10-20T10:15:00Z",
};

test("upcoming requests distinguish waiting from an accepted place", () => {
  const pending = requestPresentation(request, now);
  assert.equal(pending.label, "Waiting for host");
  assert.equal(pending.history, false);
  assert.equal(pending.canWithdraw, true);
  assert.equal(pending.canLeave, false);
  const approved = requestPresentation(
    { ...request, status: "approved", postStatus: "closed" },
    now,
  );
  assert.equal(approved.label, "You're going");
  assert.equal(approved.canLeave, true);
  assert.equal(approved.canWithdraw, false);
  assert.equal(approved.history, false);
});

test("ended and cancelled plans leave upcoming even before server status updates", () => {
  for (const status of ["pending", "approved"] as const) {
    const past = requestPresentation(
      { ...request, status, postStartsAt: "2026-10-20T10:00:00Z" },
      now,
    );
    assert.equal(past.history, true);
    assert.equal(past.label, "Past plan");
    assert.equal(past.canLeave || past.canWithdraw, false);
    const cancelled = requestPresentation(
      { ...request, status, postStatus: "cancelled" },
      now,
    );
    assert.equal(cancelled.history, true);
    assert.equal(cancelled.label, "Plan cancelled");
    assert.equal(cancelled.canLeave || cancelled.canWithdraw, false);
  }
});

test("terminal requests and unavailable posts are discoverable in history", () => {
  for (const status of ["declined", "withdrawn", "full"] as const) {
    const view = requestPresentation({ ...request, status }, now);
    assert.equal(view.history, true);
    assert.equal(view.canLeave || view.canWithdraw, false);
  }
  const missing = requestPresentation(
    { ...request, postStatus: undefined, postStartsAt: undefined },
    now,
  );
  assert.equal(missing.label, "Plan unavailable");
  assert.equal(missing.history, true);
  const incomplete = requestPresentation(
    { ...request, status: "approved", postStartsAt: "invalid" },
    now,
  );
  assert.equal(incomplete.canLeave, false);
});

test("expired booking holds move to history while confirmed bookings ignore hold expiry", () => {
  const expired = bookingPresentation(
    { ...booking, holdExpiresAt: "2026-10-20T10:00:00Z" },
    now,
  );
  assert.equal(expired.history, true);
  assert.equal(expired.label, "Expired");
  assert.equal(expired.canCancel, false);
  const confirmed = bookingPresentation(
    { ...booking, status: "confirmed", holdExpiresAt: "2026-10-20T09:00:00Z" },
    now,
  );
  assert.equal(confirmed.history, false);
  assert.equal(confirmed.label, "Confirmed");
  assert.equal(confirmed.canCancel, true);
});

test("past and cancelled bookings stay in history without a misleading cancel action", () => {
  const past = bookingPresentation(
    { ...booking, status: "confirmed", slot: "2026-10-20T10:00:00Z" },
    now,
  );
  assert.equal(past.history, true);
  assert.equal(past.label, "Past booking");
  assert.equal(past.canCancel, false);
  const cancelled = bookingPresentation(
    { ...booking, status: "cancelled" },
    now,
  );
  assert.equal(cancelled.history, true);
  assert.equal(cancelled.label, "Cancelled");
  assert.equal(cancelled.canCancel, false);
});
