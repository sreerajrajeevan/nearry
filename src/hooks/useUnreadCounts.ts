import { useEffect, useState } from 'react';
import { useAuth } from '../store/AuthContext';
import { unreadMessageCount } from '../services/chat';
import {
  unreadNotificationCount,
  subscribeToNotifications,
  registerPushToken,
  presentLocal,
} from '../services/notifications';

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
        const [m, n] = await Promise.all([unreadMessageCount(), unreadNotificationCount()]);
        if (active) setCounts({ messages: m, notifications: n });
      } catch {
        /* keep last known */
      }
    };
    void refresh();
    const unsub = subscribeToNotifications(profile.id, () => void refresh());
    const timer = setInterval(refresh, 30000);
    return () => {
      active = false;
      clearInterval(timer);
      unsub();
    };
  }, [profile]);

  return counts;
}

/** Register push token + surface incoming notifications as local notifications. */
export function usePushSetup() {
  const { profile } = useAuth();
  useEffect(() => {
    if (!profile) return;
    void registerPushToken(profile.id);
    return subscribeToNotifications(profile.id, (n) => {
      void presentLocal(n.title, n.body);
    });
  }, [profile]);
}
