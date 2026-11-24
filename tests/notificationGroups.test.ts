import test from "node:test";
import assert from "node:assert/strict";
import type { AppNotification } from "../src/services/mappers";
import {
  filterNotifications,
  filtersFor,
  groupNotificationsByDay,
  notificationCategory,
  notificationLook,
  rowTime,
} from "../src/utils/notificationGroups";

const now = new Date(2026, 10, 23, 18, 0); // Mon 23 Nov 2026, 6 pm local
const at = (day: number, h: number, m = 0) =>
  new Date(2026, 10, day, h, m).toISOString();
const n = (
  id: string,
  kind: string,
  createdAt: string,
  extra: Partial<AppNotification> = {},
): AppNotification => ({
  id,
  kind,
  title: id,
  body: "",
  read: false,
  createdAt,
  ...extra,
});

const ALL_KINDS = [
  "join_request",
  "request_approved",
  "request_declined",
  "request_full",
  "post_cancelled",
  "booking",
  "booking_confirmed",
  "booking_cancelled",
  "message",
  "plan_group_message",
  "verification_approved",
  "verification_rejected",
  "selfie_review",
];

test("every notification type has a category and an icon", () => {
  for (const kind of ALL_KINDS) {
    assert.ok(notificationCategory(kind), kind);
    const look = notificationLook(kind);
    assert.ok(look.icon && look.fg && look.bg, kind);
  }
  assert.equal(notificationCategory("request_approved"), "plans");
  assert.equal(notificationCategory("booking_confirmed"), "bookings");
  assert.equal(notificationCategory("plan_group_message"), "messages");
  assert.equal(notificationCategory("verification_rejected"), "account");
  // Unknown future kinds still render.
  assert.equal(notificationCategory("something_new"), "account");
  assert.ok(notificationLook("something_new").icon);
});

test("notifications are grouped into Today, Yesterday, This week and Earlier", () => {
  const sections = groupNotificationsByDay(
    [
      n("a", "message", at(23, 17)),
      n("b", "booking_confirmed", at(23, 9)),
      n("c", "request_approved", at(22, 21)),
      n("d", "join_request", at(19, 10)),
      n("e", "post_cancelled", at(10, 10)),
    ],
    now,
  );
  assert.deepEqual(
    sections.map((s) => [s.title, s.data.map((x) => x.id)]),
    [
      ["Today", ["a", "b"]],
      ["Yesterday", ["c"]],
      ["This week", ["d"]],
      ["Earlier", ["e"]],
    ],
  );
  assert.deepEqual(
    groupNotificationsByDay([n("x", "message", at(10, 1))], now).map(
      (s) => s.title,
    ),
    ["Earlier"],
  );
});

test("filters pick the right categories and depend on the account", () => {
  const items = [
    n("plan", "request_approved", at(23, 9)),
    n("book", "booking_cancelled", at(23, 9)),
    n("chat", "message", at(23, 9)),
    n("group", "plan_group_message", at(23, 9)),
    n("acct", "verification_approved", at(23, 9)),
  ];
  const ids = (f: Parameters<typeof filterNotifications>[1]) =>
    filterNotifications(items, f).map((x) => x.id);
  assert.deepEqual(ids("all"), ["plan", "book", "chat", "group", "acct"]);
  assert.deepEqual(ids("plans"), ["plan"]);
  assert.deepEqual(ids("bookings"), ["book"]);
  assert.deepEqual(ids("messages"), ["chat", "group"]);
  assert.deepEqual(
    filtersFor("personal").map((f) => f.label),
    ["All", "Plans", "Bookings", "Messages"],
  );
  assert.deepEqual(
    filtersFor("business").map((f) => f.label),
    ["All", "Bookings", "Messages"],
  );
});

test("row times are short and match their section", () => {
  assert.equal(rowTime(now.toISOString(), now), "Just now");
  assert.equal(rowTime(at(23, 17, 59), now), "1m");
  assert.equal(rowTime(at(23, 17, 35), now), "25m");
  assert.equal(rowTime(at(23, 9), now), "9h");
  assert.equal(rowTime(at(22, 21, 30), now), "9:30 pm");
  assert.equal(rowTime(at(19, 10), now), "Thu");
  assert.equal(rowTime(at(10, 10), now), "10 Nov");
});
