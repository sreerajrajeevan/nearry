import test from "node:test";
import assert from "node:assert/strict";
import { createCoalescer } from "../src/utils/coalesce";
import { samePost } from "../src/utils/samePost";

function fakeClock() {
  let now = 0;
  let timers: { at: number; fn: () => void; id: number }[] = [];
  let id = 0;
  return {
    env: (active = () => true) => ({
      now: () => now,
      setTimer: (fn: () => void, ms: number) => {
        timers.push({ at: now + ms, fn, id: ++id });
        return id;
      },
      clearTimer: (t: unknown) => {
        timers = timers.filter((x) => x.id !== t);
      },
      isActive: active,
    }),
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const next = timers[0];
        if (!next || next.at > end) break;
        timers.shift();
        now = next.at;
        next.fn();
      }
      now = end;
    },
  };
}

test("a burst of live changes becomes one refresh", () => {
  const clock = fakeClock();
  let runs = 0;
  const c = createCoalescer(
    () => runs++,
    { waitMs: 1200, minGapMs: 5000 },
    clock.env(),
  );
  for (let i = 0; i < 50; i++) c.trigger();
  clock.advance(1199);
  assert.equal(runs, 0);
  clock.advance(1);
  assert.equal(runs, 1);
});

test("refreshes are at least five seconds apart", () => {
  const clock = fakeClock();
  let runs = 0;
  const c = createCoalescer(
    () => runs++,
    { waitMs: 1200, minGapMs: 5000 },
    clock.env(),
  );
  c.trigger();
  clock.advance(1200); // first refresh at 1.2 s
  c.trigger();
  clock.advance(2000); // 3.2 s: too soon
  assert.equal(runs, 1);
  clock.advance(3000); // 6.2 s: ≥ 5 s after the first
  assert.equal(runs, 2);
});

test("nothing refreshes in the background; one catch-up on return", () => {
  const clock = fakeClock();
  let active = false;
  let runs = 0;
  const c = createCoalescer(
    () => runs++,
    { waitMs: 1200, minGapMs: 5000 },
    clock.env(() => active),
  );
  c.trigger();
  clock.advance(10_000);
  c.trigger();
  clock.advance(10_000);
  assert.equal(runs, 0);
  active = true;
  c.resume();
  clock.advance(0);
  assert.equal(runs, 1);
  c.resume();
  clock.advance(0);
  assert.equal(runs, 1);
});

test("a reloaded copy of the same plan doesn't redraw its card", () => {
  const base = {
    id: "p1",
    title: "Badminton",
    joinedCount: 1,
    location: { latitude: 1, longitude: 2 },
  } as never;
  const copy = JSON.parse(JSON.stringify(base));
  assert.ok(samePost(base, copy));
  assert.ok(!samePost(base, { ...copy, joinedCount: 2 }));
  assert.ok(
    !samePost(base, { ...copy, location: { latitude: 1, longitude: 3 } }),
  );
});
