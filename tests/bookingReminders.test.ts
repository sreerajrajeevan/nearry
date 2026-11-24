import test from "node:test";
import assert from "node:assert/strict";
import { notificationTarget } from "../src/utils/notificationTarget";
import {
  notificationCategory,
  notificationLook,
} from "../src/utils/notificationGroups";

test("a booking reminder opens the offer and sits under Bookings", () => {
  const target = notificationTarget(
    { id: "n1", kind: "booking_reminder", refId: "offer-1" } as any,
    "personal",
  );
  assert.deepEqual(target, {
    screen: "OfferDetails",
    params: { offerId: "offer-1" },
  });
  assert.equal(notificationCategory("booking_reminder"), "bookings");
  assert.equal(notificationLook("booking_reminder").icon, "clock");
});
