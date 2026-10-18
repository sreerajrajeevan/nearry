import { AppState } from "react-native";
import { onUnreadChanged } from "../services/unreadEvents";
import { useEffect, useState } from "react";
import { useAuth } from "../store/AuthContext";
import { getUnreadCounts, UnreadCounts } from "../services/unread";
import { RequestVersion } from "../utils/requestVersion";
import {
  subscribeToNotifications,
  registerPushToken,
} from "../services/notifications";

/** Unread message + notification counts, refreshed on realtime events + poll. */
export function useUnreadCounts() {
  const { profile } = useAuth();
  const [counts, setCounts] = useState<UnreadCounts>({
    messages: 0,
    notifications: 0,
    activity: 0,
  });

  useEffect(() => {
    setCounts({ messages: 0, notifications: 0, activity: 0 });
    if (!profile) return;
    let active = true;
    const version = new RequestVersion();
    const refresh = async () => {
      const ticket = version.next();
      try {
        const result = await getUnreadCounts();
        if (active && version.current(ticket)) setCounts(result);
      } catch {
        /* keep last known */
      }
    };
    void refresh();
    const unsub = subscribeToNotifications(profile.id, () => void refresh());
    const stopLocal = onUnreadChanged(() => void refresh());
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    const timer = setInterval(refresh, 30000);
    return () => {
      active = false;
      clearInterval(timer);
      unsub();
      stopLocal();
      appState.remove();
    };
  }, [profile?.id]);

  return counts;
}

/** The server delivers push; realtime updates the in-app center and badges. */
export function usePushSetup() {
  const { profile } = useAuth();
  useEffect(() => {
    if (!profile) return;
    void registerPushToken(profile.id).catch(() => {});
  }, [profile?.id]);
}
