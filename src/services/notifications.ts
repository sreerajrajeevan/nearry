import { notificationPreferences, setPushEnabled } from "./safety";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getSupabase, isSupabaseConfigured, isDemoMode } from "./supabase";
import { notifyUnreadChanged } from "./unreadEvents";
import { multiplexSubscribe } from "./realtime";
import { mockNotifications } from "../data/mock";
import { AppNotification, DbNotification, toAppNotification } from "./mappers";

const useMock = () => {
  if (isDemoMode()) return true;
  if (!isSupabaseConfigured)
    throw new Error("Backend not configured. Choose demo mode to preview.");
  return false;
};

// How local notifications behave when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const TOKEN_KEY = "nearry.pushToken";
let registration: Promise<void> = Promise.resolve();
/** Registration and sign-out removal are serialized to avoid leaving a token behind. */
export function registerPushToken(
  userId: string,
  force = false,
): Promise<void> {
  registration = registration
    .catch(() => {})
    .then(async () => {
      if (useMock() || !Device.isDevice || Platform.OS === "web") return;
      if (!force && !(await notificationPreferences()).pushEnabled) return;
      const db = getSupabase()!;
      const { data: auth } = await db.auth.getSession();
      if (auth.session?.user.id !== userId) return;
      if (Platform.OS === "android")
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      const { status } = await Notifications.getPermissionsAsync();
      // Ask from an explicit user action; startup only registers an existing permission.
      if (status !== "granted") return;
      const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
      if (!projectId)
        throw new Error("Notifications are not configured for this build.");
      const token = (await Notifications.getExpoPushTokenAsync({ projectId }))
        .data;
      const { data: current } = await db.auth.getSession();
      if (current.session?.user.id !== userId) return;
      const { error } = await db.rpc("register_push_token", {
        p_token: token,
        p_platform: Platform.OS,
      });
      if (error) throw error;
      await AsyncStorage.setItem(TOKEN_KEY, token);
    });
  return registration;
}
/** Permission is requested only when the user taps Enable notifications. */
export async function enablePushNotifications(userId: string): Promise<void> {
  if (useMock()) throw new Error("Push notifications require a real account.");
  if (!Device.isDevice) throw new Error("Try this on a physical device.");
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted")
    throw new Error(
      "Notifications are disabled. Enable them in system settings.",
    );
  await registerPushToken(userId, true);
  await setPushEnabled(true);
}
export async function unregisterPushToken(): Promise<void> {
  await registration.catch(() => {});
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token || !isSupabaseConfigured) return;
  const { error } = await getSupabase()!
    .from("push_tokens")
    .delete()
    .eq("token", token);
  if (error)
    throw new Error(
      "Could not disconnect notifications. Please retry sign-out.",
    );
  await AsyncStorage.removeItem(TOKEN_KEY);
}

/** In-app notification center feed, newest first. */
export async function listNotifications(): Promise<AppNotification[]> {
  if (useMock()) return mockNotifications;
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return ((data ?? []) as DbNotification[]).map(toAppNotification);
}

export async function unreadNotificationCount(): Promise<number> {
  if (useMock()) return mockNotifications.filter((n) => !n.read).length;
  const supabase = getSupabase()!;
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  if (useMock()) {
    const n = mockNotifications.find((x) => x.id === id);
    if (n) n.read = true;
    notifyUnreadChanged();
    return;
  }
  const supabase = getSupabase()!;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) throw new Error(error.message);
  notifyUnreadChanged();
}

export async function markAllNotificationsRead(): Promise<void> {
  if (useMock()) {
    mockNotifications.forEach((n) => {
      n.read = true;
    });
    notifyUnreadChanged();
    return;
  }
  const supabase = getSupabase()!;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw new Error(error.message);
  notifyUnreadChanged();
}

/** Mark a single notification as unread again. */
export async function markNotificationUnread(id: string): Promise<void> {
  if (useMock()) {
    const n = mockNotifications.find((x) => x.id === id);
    if (n) n.read = false;
    notifyUnreadChanged();
    return;
  }
  const supabase = getSupabase()!;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  notifyUnreadChanged();
}

/** Delete one notification. */
export async function deleteNotification(id: string): Promise<void> {
  if (useMock()) {
    const i = mockNotifications.findIndex((x) => x.id === id);
    if (i >= 0) mockNotifications.splice(i, 1);
    notifyUnreadChanged();
    return;
  }
  const supabase = getSupabase()!;
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) throw new Error(error.message);
  notifyUnreadChanged();
}

/** Delete all of the user's notifications. */
export async function clearAllNotifications(): Promise<void> {
  if (useMock()) {
    mockNotifications.length = 0;
    notifyUnreadChanged();
    return;
  }
  const supabase = getSupabase()!;
  const { error } = await supabase
    .from("notifications")
    .delete()
    .not("id", "is", null);
  if (error) throw new Error(error.message);
  notifyUnreadChanged();
}

/**
 * Remote push via the `send-push` edge function. Fire-and-forget:
 * resolves silently if the function isn't deployed yet.
 */
/** @deprecated Delivery is scheduled from server-owned notification rows. */
export async function pushToUser(
  _userId: string,
  _title: string,
  _body: string,
): Promise<void> {
  // Compatibility for existing action callers. No client-supplied push payload is sent.
}

/** Show a local notification for an event (called on realtime inserts). */
export async function presentLocal(title: string, body: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  } catch {
    /* notifications unavailable — ignore */
  }
}

/** Realtime subscription for my incoming notifications.
 * Multiplexed via ./realtime: useUnreadCounts and usePushSetup both subscribe
 * for the same user; one channel per topic is shared by all subscribers. */
export function subscribeToNotifications(
  userId: string,
  onChange: () => void,
): () => void {
  if (useMock()) return () => {};
  return multiplexSubscribe(
    `notifs-${userId}`,
    (ch, fire) =>
      ch.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          fire();
        },
      ),
    onChange,
  );
}

/** Fetch by opaque ID; RLS verifies the recipient before a push can navigate. */
export async function getNotification(
  id: string,
): Promise<AppNotification | null> {
  if (useMock()) return mockNotifications.find((n) => n.id === id) ?? null;
  const { data, error } = await getSupabase()!
    .from("notifications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toAppNotification(data as DbNotification) : null;
}
