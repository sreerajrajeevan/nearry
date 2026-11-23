import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTimeline,
  dayLabel,
  eventText,
  isEmojiOnly,
  nameColour,
  NAME_COLOURS,
  type TimelineMessage,
} from "../src/utils/chatTimeline";

// Local-time dates so the tests pass in any time zone.
const at = (day: number, h: number, m = 0) =>
  new Date(2026, 10, day, h, m).toISOString();
const now = new Date(2026, 10, 23, 18, 0);
const msg = (
  id: string,
  senderId: string,
  createdAt: string,
  body = "hi",
): TimelineMessage => ({
  id,
  senderId,
  senderName: senderId === "me" ? "You" : senderId,
  body,
  createdAt,
  mine: senderId === "me",
});

test("day labels say Today, Yesterday, then the weekday and date", () => {
  assert.equal(dayLabel(new Date(2026, 10, 23, 9), now), "Today");
  assert.equal(dayLabel(new Date(2026, 10, 22, 23, 59), now), "Yesterday");
  assert.equal(dayLabel(new Date(2026, 10, 20, 9), now), "Fri, 20 Nov");
  assert.equal(dayLabel(new Date(2025, 11, 31, 9), now), "31 Dec 2025");
});

test("messages are grouped into days and runs, with one time per run", () => {
  const items = buildTimeline(
    [
      msg("1", "anu", at(22, 20, 0)),
      msg("2", "anu", at(23, 9, 0)),
      msg("3", "anu", at(23, 9, 2)),
      msg("4", "me", at(23, 9, 3)),
      msg("5", "anu", at(23, 9, 30)),
    ],
    [],
    { now, myId: "me" },
  );
  assert.deepEqual(
    items.map((i) =>
      i.type === "message"
        ? `${i.message.id}:${i.firstInRun ? "F" : "-"}${i.lastInRun ? "L" : "-"}`
        : `${i.type}:${i.type === "day" ? i.label : i.text}`,
    ),
    [
      "day:Yesterday",
      "1:FL",
      "day:Today",
      "2:F-",
      "3:-L",
      "4:FL",
      // More than 5 minutes later starts a new run, even from the same person.
      "5:FL",
    ],
  );
});

test("join and leave lines sit between messages and break a run", () => {
  const items = buildTimeline(
    [msg("1", "anu", at(23, 9, 0)), msg("2", "anu", at(23, 9, 2))],
    [
      {
        id: "e1",
        userId: "rahul",
        name: "Rahul",
        kind: "joined",
        createdAt: at(23, 9, 1),
      },
      {
        id: "e2",
        userId: "me",
        name: "Sree",
        kind: "left",
        createdAt: at(23, 9, 5),
      },
    ],
    { now, myId: "me" },
  );
  assert.deepEqual(
    items.map((i) =>
      i.type === "message"
        ? `${i.message.id}:${i.firstInRun ? "F" : "-"}${i.lastInRun ? "L" : "-"}`
        : `${i.type}:${i.type === "day" ? i.label : i.text}`,
    ),
    ["day:Today", "1:FL", "event:Rahul joined", "2:FL", "event:You left"],
  );
});

test("join and leave lines read naturally", () => {
  const e = (kind: "joined" | "left" | "removed", userId = "anu") => ({
    id: "x",
    userId,
    name: "Anu",
    kind,
    createdAt: at(23, 9),
  });
  assert.equal(eventText(e("joined"), "me"), "Anu joined");
  assert.equal(eventText(e("left"), "me"), "Anu left");
  assert.equal(eventText(e("removed"), "me"), "Anu is no longer in the plan");
  assert.equal(eventText(e("joined", "me"), "me"), "You joined");
});

test("only short emoji messages count as emoji-only", () => {
  assert.equal(isEmojiOnly("😂😂"), true);
  assert.equal(isEmojiOnly("🥹 🥹 🥹"), true);
  assert.equal(isEmojiOnly("👍🏽"), true);
  assert.equal(isEmojiOnly("👨‍👩‍👧"), true);
  assert.equal(isEmojiOnly("❤️"), true);
  assert.equal(isEmojiOnly("ok 👍"), false);
  assert.equal(isEmojiOnly("2"), false);
  assert.equal(isEmojiOnly("#"), false);
  assert.equal(isEmojiOnly(""), false);
  assert.equal(isEmojiOnly("😂😂😂😂😂😂😂"), false);
});

test("each person keeps the same readable name colour", () => {
  assert.equal(nameColour("anu"), nameColour("anu"));
  assert.ok(NAME_COLOURS.includes(nameColour("rahul")));
  const spread = new Set(
    ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map(nameColour),
  );
  assert.ok(spread.size >= 4);
});
