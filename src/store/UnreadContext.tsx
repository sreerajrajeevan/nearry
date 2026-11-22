import React, { createContext, useContext, useEffect, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "./AuthContext";
import { getUnreadCounts, type UnreadCounts } from "../services/unread";
import { subscribeToNotifications } from "../services/notifications";
import { onUnreadChanged } from "../services/unreadEvents";
import { createCoalescer } from "../utils/coalesce";
const zero: UnreadCounts = { messages: 0, notifications: 0, activity: 0 };
const Context = createContext<UnreadCounts>(zero);
/** One account-scoped poll and coalesced RPC for all tab/header/profile consumers. */
export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth(),
    id = profile?.id ?? null;
  const [snapshot, setSnapshot] = useState<{
    id: string | null;
    counts: UnreadCounts;
  }>({ id: null, counts: zero });
  useEffect(() => {
    let alive = true,
      running = false,
      again = false;
    setSnapshot({ id, counts: zero });
    if (!id) return;
    const refresh = async () => {
      if (!alive || AppState.currentState !== "active") return;
      if (running) {
        again = true;
        return;
      }
      running = true;
      try {
        const counts = await getUnreadCounts(id);
        if (alive) setSnapshot({ id, counts });
      } catch {
        /* Keep last good counts. */
      } finally {
        running = false;
        if (again && alive) {
          again = false;
          calm.trigger();
        }
      }
    };
    const calm = createCoalescer(
      () => void refresh(),
      { waitMs: 150, minGapMs: 1000 },
      {
        now: Date.now,
        setTimer: (fn, ms) => setTimeout(fn, ms),
        clearTimer: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
        isActive: () => AppState.currentState === "active",
      },
    );
    const stop = subscribeToNotifications(id, () => calm.trigger()),
      local = onUnreadChanged(() => calm.trigger());
    const app = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        calm.resume();
        calm.trigger();
      }
    });
    const timer = setInterval(() => calm.trigger(), 30_000);
    void refresh();
    return () => {
      alive = false;
      calm.cancel();
      stop();
      local();
      app.remove();
      clearInterval(timer);
    };
  }, [id]);
  return (
    <Context.Provider value={snapshot.id === id ? snapshot.counts : zero}>
      {children}
    </Context.Provider>
  );
}
export const useSharedUnread = () => useContext(Context);
