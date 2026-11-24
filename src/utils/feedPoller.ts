/**
 * Calm refresh for busy shared lists (plans, offers, bookings). Instead of
 * every phone listening to every change in every city, a list refreshes:
 *  - every `intervalMs` while the app is in the foreground,
 *  - once on returning to the foreground if the last refresh is stale,
 *  - at once when nudged by something about this user (their own
 *    notification feed: a join request, an approval, a booking).
 */
export type FeedPollerDeps = {
  intervalMs: number;
  staleMs: number;
  now: () => number;
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (handle: unknown) => void;
  isActive: () => boolean;
};

export function createFeedPoller(onTick: () => void, deps: FeedPollerDeps) {
  let handle: unknown = null;
  let last = 0;
  let pending = false;
  const fire = () => {
    last = deps.now();
    pending = false;
    onTick();
  };
  return {
    start() {
      if (handle !== null) return;
      last = deps.now();
      handle = deps.setInterval(() => {
        if (deps.isActive()) fire();
        else pending = true;
      }, deps.intervalMs);
    },
    resume() {
      if (!deps.isActive()) return;
      if (pending || deps.now() - last >= deps.staleMs) fire();
    },
    nudge() {
      if (deps.isActive()) fire();
      else pending = true;
    },
    stop() {
      if (handle !== null) deps.clearInterval(handle);
      handle = null;
    },
  };
}
