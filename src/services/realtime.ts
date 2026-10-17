import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

type Entry<TArgs extends unknown[]> = {
  callbacks: Set<(...args: TArgs) => void>;
  remove: () => void;
};

const channels = new Map<string, Entry<any[]>>();

/**
 * One realtime channel per topic, shared by every subscriber.
 *
 * supabase-js returns the *cached* channel when .channel() is called twice
 * with the same topic, and calling .on() on an already-subscribed channel
 * throws "cannot add postgres_changes callbacks after subscribe()".
 * So we subscribe once per topic and fan events out to all callbacks;
 * the channel is removed when the last subscriber unsubscribes.
 */
export function multiplexSubscribe<TArgs extends unknown[]>(
  topic: string,
  setup: (
    ch: RealtimeChannel,
    fire: (...args: TArgs) => void,
  ) => RealtimeChannel,
  onEvent: (...args: TArgs) => void,
): () => void {
  const supabase = getSupabase()!;
  let entry = channels.get(topic) as Entry<TArgs> | undefined;
  if (!entry) {
    const callbacks = new Set<(...args: TArgs) => void>();
    const fire = (...args: TArgs) => {
      callbacks.forEach((cb) => {
        try {
          cb(...args);
        } catch {
          /* one bad listener must not break the others */
        }
      });
    };
    const ch = setup(supabase.channel(topic), fire).subscribe();
    const e: Entry<TArgs> = {
      callbacks,
      remove: () => {
        channels.delete(topic);
        supabase.removeChannel(ch);
      },
    };
    channels.set(topic, e as Entry<any[]>);
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
