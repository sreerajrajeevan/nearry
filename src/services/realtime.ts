import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

type Entry = {
  callbacks: Set<() => void>;
  remove: () => void;
};

const channels = new Map<string, Entry>();

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
): () => void {
  const supabase = getSupabase()!;
  let entry = channels.get(topic);
  if (!entry) {
    const callbacks = new Set<() => void>();
    const fire = () => {
      callbacks.forEach((cb) => {
        try {
          cb();
        } catch {
          /* one bad listener must not break the others */
        }
      });
    };
    const ch = setup(supabase.channel(topic), fire).subscribe((status) => {
      // Also reload after reconnect: events during a disconnect are not replayed.
      if (status === "SUBSCRIBED") fire();
    });
    const e: Entry = {
      callbacks,
      remove: () => {
        channels.delete(topic);
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
