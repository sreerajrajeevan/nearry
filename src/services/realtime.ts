import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import { createCoalescer } from "../utils/coalesce";

type Entry = {
  callbacks: Set<() => void>;
  remove: () => void;
};

const channels = new Map<string, Entry>();

/** At most one refresh every 5 s, 1.2 s after a burst of changes settles. */
export const LIVE_FEED_CALM = { waitMs: 1200, minGapMs: 5000 };

/**
 * One realtime channel per topic, shared by every subscriber.
 *
 * supabase-js returns the *cached* channel when .channel() is called twice
 * with the same topic, and calling .on() on an already-subscribed channel
 * throws "cannot add postgres_changes callbacks after subscribe()".
 * So we subscribe once per topic and fan events out to all callbacks;
 * the channel is removed when the last subscriber unsubscribes.
 */
export function multiplexSubscribe(
  topic: string,
  setup: (ch: RealtimeChannel, fire: () => void) => RealtimeChannel,
  onEvent: () => void,
  /**
   * For busy, app-wide feeds (all plans, all offers): group bursts of
   * changes into one refresh at most every `minGapMs`, and none while the
   * app is in the background. Leave unset where speed matters (chat).
   */
  calm?: { waitMs: number; minGapMs: number },
): () => void {
  const supabase = getSupabase()!;
  let entry = channels.get(topic);
  if (!entry) {
    const callbacks = new Set<() => void>();
    const notify = () => {
      callbacks.forEach((cb) => {
        try {
          cb();
        } catch {
          /* one bad listener must not break the others */
        }
      });
    };
    // Loaded only when a calm feed starts, so plain Node tests of services
    // that import this module never load React Native.
    const { AppState } = calm
      ? (require("react-native") as typeof import("react-native"))
      : ({} as typeof import("react-native"));
    const calmer = calm
      ? createCoalescer(notify, calm, {
          now: Date.now,
          setTimer: (fn, ms) => setTimeout(fn, ms),
          clearTimer: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
          isActive: () => AppState.currentState === "active",
        })
      : null;
    const fire = calmer ? () => calmer.trigger() : notify;
    const app = calmer
      ? AppState.addEventListener("change", (state) => {
          if (state === "active") calmer.resume();
        })
      : null;
    const ch = setup(supabase.channel(topic), fire).subscribe((status) => {
      // Also reload after reconnect: events during a disconnect are not replayed.
      if (status === "SUBSCRIBED") fire();
    });
    const e: Entry = {
      callbacks,
      remove: () => {
        channels.delete(topic);
        calmer?.cancel();
        app?.remove();
        supabase.removeChannel(ch);
      },
    };
    channels.set(topic, e);
    entry = e;
  }
  entry.callbacks.add(onEvent);
  let subscribed = true;
  const original = entry;
  return () => {
    if (!subscribed) return;
    subscribed = false;
    if (channels.get(topic) !== original) return;
    original.callbacks.delete(onEvent);
    if (original.callbacks.size === 0) original.remove();
  };
}

type CalmEntry = { callbacks: Set<() => void>; remove: () => void };
const calmFeeds = new Map<string, CalmEntry>();
/** Busy shared lists refresh at this pace while the app is open. */
export const CALM_FEED_INTERVAL_MS = 60_000;

/**
 * A shared list (plans, offers, bookings) that refreshes calmly instead of
 * listening to every row change in every city: every minute while the app
 * is open, on return to the foreground when stale, and at once when this
 * user gets a notification (join request, approval, booking...). Each phone
 * then only receives its own events. Returns unsubscribe.
 */
export function calmFeed(topic: string, onChange: () => void): () => void {
  let entry = calmFeeds.get(topic);
  if (!entry) {
    const callbacks = new Set<() => void>();
    const notify = () =>
      callbacks.forEach((cb) => {
        try {
          cb();
        } catch {
          /* one bad listener must not break the others */
        }
      });
    const { AppState } =
      require("react-native") as typeof import("react-native");
    const { createFeedPoller } =
      require("../utils/feedPoller") as typeof import("../utils/feedPoller");
    const poller = createFeedPoller(notify, {
      intervalMs: CALM_FEED_INTERVAL_MS,
      staleMs: CALM_FEED_INTERVAL_MS / 2,
      now: Date.now,
      setInterval: (fn, ms) => setInterval(fn, ms),
      clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
      isActive: () => AppState.currentState === "active",
    });
    poller.start();
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") poller.resume();
    });
    // The user's own notifications are the instant signal.
    let stopNudge: (() => void) | null = null,
      closed = false;
    void getSupabase()!
      .auth.getSession()
      .then(({ data }) => {
        const uid = data.session?.user.id;
        if (!uid || closed) return;
        stopNudge = multiplexSubscribe(
          "my-notifications-" + uid,
          (ch, fire) =>
            ch.on(
              "postgres_changes",
              {
                event: "INSERT",
                schema: "public",
                table: "notifications",
                filter: `user_id=eq.${uid}`,
              },
              () => fire(),
            ),
          () => poller.nudge(),
        );
      })
      .catch(() => {});
    const e: CalmEntry = {
      callbacks,
      remove: () => {
        closed = true;
        calmFeeds.delete(topic);
        poller.stop();
        app.remove();
        stopNudge?.();
      },
    };
    calmFeeds.set(topic, e);
    entry = e;
  }
  entry.callbacks.add(onChange);
  const original = entry;
  let subscribed = true;
  return () => {
    if (!subscribed) return;
    subscribed = false;
    if (calmFeeds.get(topic) !== original) return;
    original.callbacks.delete(onChange);
    if (original.callbacks.size === 0) original.remove();
  };
}
