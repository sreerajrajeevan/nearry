/**
 * Turns a burst of "something changed" signals into one refresh: waits a
 * moment for the burst to settle, keeps refreshes a minimum gap apart, and
 * holds them while the app is in the background, catching up once on return.
 */
export function createCoalescer(
  run: () => void,
  {
    waitMs,
    minGapMs,
  }: {
    /** Wait this long after a change before refreshing. */
    waitMs: number;
    /** Never refresh more often than this. */
    minGapMs: number;
  },
  env: {
    now: () => number;
    setTimer: (fn: () => void, ms: number) => unknown;
    clearTimer: (timer: unknown) => void;
    isActive: () => boolean;
  } = {
    now: Date.now,
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
    isActive: () => true,
  },
) {
  let timer: unknown = null;
  let last = -Infinity;
  let held = false;
  const flush = () => {
    timer = null;
    if (!env.isActive()) {
      held = true;
      return;
    }
    held = false;
    last = env.now();
    run();
  };
  return {
    /** A change happened. */
    trigger() {
      if (timer !== null) return;
      const wait = Math.max(waitMs, last + minGapMs - env.now());
      timer = env.setTimer(flush, wait);
    },
    /** The app is back in front: run once if something was held. */
    resume() {
      if (held && timer === null) {
        held = false;
        timer = env.setTimer(flush, 0);
      }
    },
    cancel() {
      if (timer !== null) env.clearTimer(timer);
      timer = null;
      held = false;
    },
  };
}
