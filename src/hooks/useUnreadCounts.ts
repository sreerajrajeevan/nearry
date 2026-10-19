import * as Notifications from "expo-notifications";
import {
  getNotification,
  markNotificationRead,
} from "../services/notifications";
import { notificationTarget } from "../utils/notificationTarget";
import { navigationRef } from "../navigation/navigationRef";
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
    if (!profile || profile.suspendedAt || profile.deletionRequestedAt) return;
    let active = true;
    const opened = new Set<string>();
    const inFlight = new Set<string>();
    const open = async (
      response: Notifications.NotificationResponse | null,
    ) => {
      const id = response?.notification.request.content.data?.notificationId;
      if (
        typeof id !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(id) ||
        opened.has(id) ||
        inFlight.has(id)
      )
        return;
      inFlight.add(id);
      try {
        const notice = await getNotification(id);
        if (!active) return;
        if (!notice) {
          await Notifications.clearLastNotificationResponseAsync();
          return;
        }
        if (!navigationRef.isReady()) return;
        const route = notificationTarget(notice, profile.accountType);
        opened.add(id);
        navigationRef.navigate(
          profile.accountType === "business" ? "BusinessApp" : "PersonalApp",
          { screen: route.screen, params: route.params },
        );
        await markNotificationRead(id);
        await Notifications.clearLastNotificationResponseAsync();
      } catch {
        /* The in-app center remains available for retry. */
      } finally {
        inFlight.delete(id);
      }
    };
    void registerPushToken(profile.id).catch(() => {});
    const navReady = navigationRef.addListener("state", () => {
      void Notifications.getLastNotificationResponseAsync()
        .then(open)
        .catch(() => {});
    });
    const tap = Notifications.addNotificationResponseReceivedListener(
      (response) => void open(response),
    );
    void Notifications.getLastNotificationResponseAsync()
      .then(open)
      .catch(() => {});
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void registerPushToken(profile.id).catch(() => {});
        void Notifications.getLastNotificationResponseAsync()
          .then(open)
          .catch(() => {});
      }
    });
    return () => {
      active = false;
      navReady();
      tap.remove();
      app.remove();
    };
  }, [profile?.id]);
}
