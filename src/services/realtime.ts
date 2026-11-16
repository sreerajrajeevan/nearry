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
