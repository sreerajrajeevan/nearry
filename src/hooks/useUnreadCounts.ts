import * as Notifications from "expo-notifications";
import {
  getNotification,
  markNotificationRead,
} from "../services/notifications";
import { notificationTarget } from "../utils/notificationTarget";
import { navigationRef } from "../navigation/navigationRef";
import { AppState } from "react-native";
import { useEffect } from "react";
import { useAuth } from "../store/AuthContext";
import {
  registerPushToken,
  retryPendingPushCleanup,
} from "../services/notifications";

/** All surfaces consume the same account-scoped unread snapshot. */
export { useSharedUnread as useUnreadCounts } from "../store/UnreadContext";

/** The server delivers push; realtime updates the in-app center and badges. */
export function usePushSetup() {
  const { profile } = useAuth();
  useEffect(() => {
    const retry = () => {
      if (AppState.currentState === "active")
        void retryPendingPushCleanup().catch(() => {});
    };
    retry();
    const app = AppState.addEventListener("change", retry);
    const timer = setInterval(retry, 30_000);
    return () => {
      app.remove();
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (
      !profile ||
      profile.suspendedAt ||
      profile.deletionRequestedAt ||
      !profile.onboardingCompleted
    )
      return;
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
  }, [
    profile?.id,
    profile?.onboardingCompleted,
    profile?.suspendedAt,
    profile?.deletionRequestedAt,
  ]);
}
