import test from "node:test";
import assert from "node:assert/strict";
import { notificationTarget } from "../src/utils/notificationTarget";
import {
  notificationCategory,
  notificationLook,
} from "../src/utils/notificationGroups";
import {
  indiaDayKey,
  plansToPrompt,
  reminderStatusText,
  type TodayPlan,
} from "../src/utils/planReminders";

const plan = (over: Partial<TodayPlan>): TodayPlan => ({
  postId: "p1",
  title: "Evening football",
  startsAt: "2026-11-24T12:30:00.000Z",
  place: "Kaloor Turf",
  host: false,
  myStatus: null,
  going: 0,
  members: 3,
  ...over,
});

test("a plan reminder opens the plan and is filed under Plans", () => {
  const notice = {
    id: "n1",
    kind: "plan_reminder",
    title: "Today: Evening football",
    body: "6:00 pm at Kaloor Turf. Still going?",
    read: false,
    createdAt: "2026-11-24T02:30:00.000Z",
    refId: "p1",
  };
  assert.deepEqual(notificationTarget(notice, "personal"), {
    screen: "PostDetails",
    params: { postId: "p1" },
  });
  assert.equal(notificationCategory("plan_reminder"), "plans");
  assert.equal(notificationLook("plan_reminder").icon, "calendar");
});

test("the pop-up shows today's plans that haven't been answered or dismissed", () => {
  const plans = [
    plan({ postId: "a" }),
    plan({ postId: "b", myStatus: "going" }),
    plan({ postId: "c", host: true }),
    plan({ postId: "d" }),
  ];
  assert.deepEqual(
    plansToPrompt(plans, ["d"]).map((p) => p.postId),
    ["a", "c"],
  );
  // Everything answered or dismissed: no pop-up.
  assert.deepEqual(plansToPrompt([plan({ myStatus: "not_going" })], []), []);
});

test("the dismissal key is the India-time date", () => {
  // 23 Nov 2026, 20:00 UTC is already 24 Nov in India.
  assert.equal(indiaDayKey(new Date("2026-11-23T20:00:00Z")), "2026-11-24");
  assert.equal(indiaDayKey(new Date("2026-11-23T18:00:00Z")), "2026-11-23");
});

test("rows read naturally for members and hosts", () => {
  assert.equal(
    reminderStatusText(plan({ host: true, going: 2, members: 3 })),
    "You're hosting · 2 of 3 confirmed",
  );
  assert.equal(reminderStatusText(plan({})), "Still going?");
  assert.equal(reminderStatusText(plan({ myStatus: "going" })), "You're going");
});
