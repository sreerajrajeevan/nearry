import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUTOPLAY_RESUME_MS,
  nextSlide,
  shouldAutoAdvance,
} from "../src/utils/carousel";

test("carousel: advances in a loop", () => {
  assert.equal(nextSlide(0, 3), 1);
  assert.equal(nextSlide(2, 3), 0);
  assert.equal(nextSlide(5, 3), 0);
});

test("carousel: only autoplays when it's visible, wanted and not being touched", () => {
  const base = {
    count: 3,
    reduced: false,
    screenReader: false,
    focused: true,
    active: true,
    pausedUntil: 0,
    now: 10_000,
  };
  assert.equal(shouldAutoAdvance(base), true);
  assert.equal(shouldAutoAdvance({ ...base, count: 1 }), false);
  assert.equal(shouldAutoAdvance({ ...base, reduced: true }), false);
  assert.equal(shouldAutoAdvance({ ...base, screenReader: true }), false);
  assert.equal(shouldAutoAdvance({ ...base, focused: false }), false);
  assert.equal(shouldAutoAdvance({ ...base, active: false }), false);
  // A touch pauses autoplay for a while, then it resumes.
  const touched = { ...base, pausedUntil: base.now + AUTOPLAY_RESUME_MS };
  assert.equal(shouldAutoAdvance(touched), false);
  assert.equal(
    shouldAutoAdvance({ ...touched, now: touched.pausedUntil + 1 }),
    true,
  );
});
