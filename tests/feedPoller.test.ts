import test from "node:test";
import assert from "node:assert/strict";
import { createFeedPoller } from "../src/utils/feedPoller";

function harness(active = true) {
  let now = 0;
  let timer: (() => void) | null = null;
  let state = { active };
  const ticks: number[] = [];
  const poller = createFeedPoller(() => ticks.push(now), {
    intervalMs: 60_000,
    staleMs: 30_000,
    now: () => now,
    setInterval: (fn) => {
      timer = fn;
      return 1;
    },
    clearInterval: () => {
      timer = null;
    },
    isActive: () => state.active,
  });
  return {
    poller,
    ticks,
    advance(ms: number) {
      now += ms;
      timer?.();
    },
    setActive(v: boolean) {
      state.active = v;
    },
    hasTimer: () => timer !== null,
  };
}

test("refreshes on each interval while the app is open", () => {
  const h = harness();
  h.poller.start();
  h.advance(60_000);
  h.advance(60_000);
  assert.deepEqual(h.ticks, [60_000, 120_000]);
});

test("stays quiet in the background, then refreshes once on return if stale", () => {
  const h = harness();
  h.poller.start();
  h.setActive(false);
  h.advance(60_000);
  h.advance(60_000);
  assert.deepEqual(h.ticks, []);
  h.setActive(true);
  h.poller.resume();
  assert.deepEqual(h.ticks, [120_000]);
  // A quick second resume doesn't refresh again.
  h.poller.resume();
  assert.equal(h.ticks.length, 1);
});

test("a nudge refreshes at once and counts as fresh", () => {
  const h = harness();
  h.poller.start();
  h.poller.nudge();
  assert.deepEqual(h.ticks, [0]);
  // Coming back right after doesn't refresh a second time.
  h.poller.resume();
  assert.deepEqual(h.ticks, [0]);
});

test("a nudge while in the background waits for the app to come back", () => {
  const h = harness();
  h.poller.start();
  h.setActive(false);
  h.poller.nudge();
  assert.deepEqual(h.ticks, []);
  h.setActive(true);
  h.poller.resume();
  assert.deepEqual(h.ticks, [0]);
});

test("stop clears the timer", () => {
  const h = harness();
  h.poller.start();
  h.poller.stop();
  assert.equal(h.hasTimer(), false);
});
