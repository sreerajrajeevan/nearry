import { AppState } from "react-native";
import { onUnreadChanged } from "../services/unreadEvents";
import { useEffect, useState } from "react";
import { useAuth } from "../store/AuthContext";
import { unreadMessageCount } from "../services/chat";
import {
  unreadNotificationCount,
  subscribeToNotifications,
  registerPushToken,
  presentLocal,
} from "../services/notifications";

/** Unread message + notification counts, refreshed on realtime events + poll. */
export function useUnreadCounts() {
  const { profile } = useAuth();
  const [counts, setCounts] = useState({ messages: 0, notifications: 0 });

  useEffect(() => {
    if (!profile) {
      setCounts({ messages: 0, notifications: 0 });
      return;
    }
    let active = true;
    const refresh = async () => {
      try {
        const [m, n] = await Promise.all([
          unreadMessageCount(),
          unreadNotificationCount(),
        ]);
        if (active) setCounts({ messages: m, notifications: n });
      } catch {
        /* keep last known */
      }
    };
    void refresh();
    const unsub = subscribeToNotifications(profile.id, (n) => {
      void refresh();
      // Foreground banner for incoming notifications.
      if (n.title) void presentLocal(n.title, n.body ?? "");
    });
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
  }, [profile]);

  return counts;
}

/** The server delivers push; realtime updates the in-app center and badges. */
export function usePushSetup() {
  const { profile } = useAuth();
  useEffect(() => {
    if (!profile) return;
    void registerPushToken(profile.id).catch(() => {});
  }, [profile]);
}
