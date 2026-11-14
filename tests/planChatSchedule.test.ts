import { test } from "node:test";
import assert from "node:assert/strict";
import {
  planChatReminder,
  planChatSection,
  planChatTime,
  sortPlanChats,
} from "../src/utils/planChatSchedule";
const now = new Date(2026, 11, 31, 16).getTime();
const at = (day: number, hour: number) =>
  new Date(2026, 11, day, hour).toISOString();
test("today stays pinned ahead of tomorrow even when tomorrow has the latest message", () => {
  const today = { id: "today", startsAt: at(31, 18), lastAt: at(30, 8) };
  const tomorrow = { id: "tomorrow", startsAt: at(32, 9), lastAt: at(31, 16) };
  const early = { id: "early", startsAt: at(31, 17), lastAt: at(30, 7) };
  const input = [tomorrow, today, early];
  assert.deepEqual(
    sortPlanChats(input, now).map((c) => c.id),
    ["early", "today", "tomorrow"],
  );
  assert.equal(input[0], tomorrow);
  assert.equal(planChatSection(today, now), "today");
  assert.match(planChatTime(tomorrow, now), /^Tomorrow/);
});
test("future plans sort chronologically, finished plans and cancellations cannot jump above them", () => {
  const cards = [
    { id: "cancelled", startsAt: at(31, 17), cancelled: true },
    { id: "past", startsAt: at(30, 8), lastAt: at(31, 16) },
    { id: "later", startsAt: at(34, 9) },
    { id: "next", startsAt: at(32, 9) },
    { id: "finished-today", startsAt: at(31, 8), durationMinutes: 60 },
    { id: "today", startsAt: at(31, 18) },
  ];
  assert.deepEqual(
    sortPlanChats(cards, now).map((c) => c.id),
    ["today", "finished-today", "next", "later", "past", "cancelled"],
  );
  assert.equal(planChatReminder(cards[0], "Cancelled game", now), null);
});
test("red reminders are time-bound and use the plan title rather than a made-up activity", () => {
  assert.deepEqual(
    planChatReminder({ id: "movie", startsAt: at(31, 17) }, "Movie date", now),
    { short: "In 1h", text: "Your plan “Movie date” starts in 1 hour." },
  );
  assert.equal(
    planChatReminder({ id: "later", startsAt: at(31, 20) }, "A plan", now),
    null,
  );
  assert.equal(
    planChatReminder({ id: "boundary", startsAt: at(31, 19) }, "A plan", now)
      ?.short,
    "In 3h",
  );
  assert.equal(
    planChatReminder({ id: "invalid", startsAt: "bad" }, "A plan", now),
    null,
  );
  assert.equal(
    planChatReminder({ id: "past", startsAt: at(31, 15) }, "A plan", now),
    null,
  );
  assert.equal(
    planChatReminder(
      { id: "running", startsAt: at(31, 15), durationMinutes: 120 },
      "Football",
      now,
    )?.short,
    "Happening now",
  );
  assert.equal(
    planChatReminder(
      { id: "ended", startsAt: at(31, 14), durationMinutes: 120 },
      "Football",
      now,
    ),
    null,
  );
});
test("pin and countdown roll over at midnight and handle plans running over midnight", () => {
  const chat = { id: "late", startsAt: at(31, 23), durationMinutes: 120 };
  const afterMidnight = new Date(2027, 0, 1, 0, 30).getTime();
  assert.equal(planChatSection(chat, afterMidnight), "today");
  assert.equal(
    planChatReminder(chat, "Midnight movie", afterMidnight)?.short,
    "Happening now",
  );
  assert.equal(
    planChatSection(chat, new Date(2027, 0, 1, 1).getTime()),
    "past",
  );
  assert.equal(
    planChatReminder(
      { id: "soon", startsAt: new Date(now + 1).toISOString() },
      "Coffee",
      now,
    )?.short,
    "In 1m",
  );
});
