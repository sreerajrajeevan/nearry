import { test } from "node:test";
import assert from "node:assert/strict";
import { poseEmoji, poseTimeLeft } from "../src/utils/selfiePoses";

test("selfie poses: every server pose has a picture, and the timer counts down to expiry", () => {
  for (const id of [
    "thumbs_up",
    "peace",
    "ok",
    "point_up",
    "open_palm",
    "call_me",
    "thinking",
    "wave",
  ])
    assert.notEqual(poseEmoji(id), poseEmoji("unknown"), id);
  const now = new Date("2026-11-15T12:00:00Z");
  const at = (s: number) => new Date(now.getTime() + s * 1000).toISOString();
  assert.equal(poseTimeLeft(at(600), now), "10:00");
  assert.equal(poseTimeLeft(at(581), now), "9:41");
  assert.equal(poseTimeLeft(at(5), now), "0:05");
  assert.equal(poseTimeLeft(at(-1), now), null);
});
