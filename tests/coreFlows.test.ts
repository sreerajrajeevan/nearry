import test from "node:test";
import assert from "node:assert/strict";
import { bookingState, postState } from "../src/utils/flowState";
import { notificationTarget } from "../src/utils/notificationTarget";
import { validateOfferInput } from "../src/utils/validation";
import type {
  Booking,
  NeedPost,
  AppNotification,
} from "../src/services/mappers";

const now = Date.now();
const future = new Date(now + 7200000).toISOString();
const past = new Date(now - 7200000).toISOString();
test("unswept expiry, cancelled plans and full plans never offer a new join", () => {
  const p = { startsAt: future, status: "open", spotsLeft: 2 } as NeedPost;
  assert.equal(postState(p, now).accepting, true);
  assert.equal(postState({ ...p, expiresAt: past }, now).accepting, false);
  assert.equal(
    postState({ ...p, status: "closed", spotsLeft: 0 }, now).canCancel,
    true,
  );
  assert.equal(postState({ ...p, status: "cancelled" }, now).canLeave, false);
  assert.equal(postState({ ...p, startsAt: past }, now).canEdit, false);
});
test("a timed-out hold is expired before cron runs; a future confirmed booking is cancellable", () => {
  const b = { status: "pending", slot: future, holdExpiresAt: past } as Booking;
  assert.deepEqual(bookingState(b, now), {
    label: "Expired",
    expired: true,
    canConfirm: false,
    canCancel: false,
  });
  assert.equal(
    bookingState({ ...b, status: "confirmed" }, now).canCancel,
    true,
  );
  assert.equal(
    bookingState({ ...b, slot: past, status: "confirmed" }, now).canCancel,
    false,
  );
});
test("notifications open their account's actual workflow rather than a dead-end card", () => {
  const notice = (kind: string, refId = "context") =>
    ({ kind, refId }) as AppNotification;
  assert.deepEqual(notificationTarget(notice("message"), "business"), {
    screen: "Conversation",
    params: { conversationId: "context" },
  });
  assert.deepEqual(notificationTarget(notice("post_cancelled"), "personal"), {
    screen: "PostDetails",
    params: { postId: "context" },
  });
  assert.equal(
    notificationTarget(notice("booking_confirmed"), "personal").params.screen,
    "Activity",
  );
  assert.equal(
    notificationTarget(notice("booking"), "business").params.screen,
    "Bookings",
  );
  assert.equal(
    notificationTarget(notice("verification_approved"), "business").params
      .screen,
    "Business",
  );
});
test("an ongoing live offer can edit its description without pretending its start is future", () => {
  const offer = {
    title: "Evening offer",
    description: "An ongoing friendly offer",
    startsAt: past,
    endsAt: future,
    slotCapacity: 2,
    slotMinutes: 60,
  };
  assert.match(validateOfferInput(offer)!, /future/);
  assert.equal(validateOfferInput(offer, { allowStarted: true }), null);
  assert.match(
    validateOfferInput(
      { ...offer, endsAt: new Date(now - 1000).toISOString() },
      { allowStarted: true },
    )!,
    /ended/,
  );
});
