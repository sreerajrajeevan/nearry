import { notificationPreferences, setPushEnabled } from "./safety";
import { createClient } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";
import { authStorage } from "./authStorage";
import { createSignInFetch } from "./signInTransport";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { parsePage, type Cursor, type Page } from "../utils/pagination";
import { withDeadline } from "../utils/deadline";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { isActiveChat } from "./activeChat";
import { AppState, Platform } from "react-native";
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
  handleNotification: async (notification) => ({
    shouldShowBanner: !(
      AppState.currentState === "active" &&
      isActiveChat(notification.request.content.data.threadId)
    ),
    shouldShowList: true,
    shouldPlaySound: !(
      AppState.currentState === "active" &&
      isActiveChat(notification.request.content.data.threadId)
    ),
    shouldSetBadge: false,
  }),
});

const TOKEN_KEY = "nearry.pushToken";
let registration: Promise<void> = Promise.resolve();
let registrationVersion = 0;
let registering = false;
const INSTALLATION_KEY = "nearry.push.installation.v1";
type Installation = {
  token: string;
  secret: string;
  userId: string;
  pending: boolean;
};
async function installation(): Promise<Installation | null> {
  const raw = await authStorage.getItem(INSTALLATION_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return typeof value.token === "string" &&
      /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(
        value.token,
      ) &&
      /^[a-f0-9]{64}$/.test(value.secret) &&
      typeof value.userId === "string"
      ? value
      : null;
  } catch {
    return null;
  }
}
export async function retryPendingPushCleanup(): Promise<void> {
  if (!isSupabaseConfigured || registering) return;
  const saved = await installation();
  if (!saved?.pending) return;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL!,
    key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
  const publicClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: createSignInFetch(url, fetch, 3_000) },
  });
  const { error } = await publicClient.rpc("revoke_push_installation", {
    p_token: saved.token,
    p_secret: saved.secret,
  });
  if (error) throw new Error("Notification cleanup will retry when connected.");
  const current = await installation();
  if (
    current?.pending &&
    current.token === saved.token &&
    current.secret === saved.secret
  )
    await authStorage.removeItem(INSTALLATION_KEY);
}

/** Registration and sign-out removal are serialized to avoid leaving a token behind. */
export function registerPushToken(
  userId: string,
  force = false,
): Promise<void> {
  const version = registrationVersion;
  registration = registration
    .catch(() => {})
    .then(async () => {
      if (useMock() || !Device.isDevice || Platform.OS === "web") return;
      if (!force && !(await notificationPreferences()).pushEnabled) return;
      const previous = await installation();
      if (previous && (previous.pending || previous.userId !== userId)) {
        await authStorage.setItem(
          INSTALLATION_KEY,
          JSON.stringify({ ...previous, pending: true }),
        );
        await retryPendingPushCleanup();
      }
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
      // The build variable wins; app.json's EAS project is the fallback, so
      // CI builds without the variable can still get a push token.
      const projectId =
        process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() ||
        (Constants.expoConfig?.extra?.eas?.projectId as string | undefined);
      if (!projectId)
        throw new Error("Notifications are not configured for this build.");
      const token = (await Notifications.getExpoPushTokenAsync({ projectId }))
        .data;
      const { data: current } = await db.auth.getSession();
      if (
        current.session?.user.id !== userId ||
        version !== registrationVersion
      )
        return;
      const secret = Array.from(Crypto.getRandomBytes(32), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      const saved: Installation = { token, secret, userId, pending: true };
      registering = true;
      await authStorage.setItem(INSTALLATION_KEY, JSON.stringify(saved));
      const { error } = await db.rpc("register_push_installation", {
        p_token: token,
        p_platform: Platform.OS,
        p_secret: secret,
      });
      if (error) throw error;
      if (version !== registrationVersion) {
        await retryPendingPushCleanup().catch(() => {});
        return;
      }
      await authStorage.setItem(
        INSTALLATION_KEY,
        JSON.stringify({ ...saved, pending: false }),
      );
      await AsyncStorage.removeItem(TOKEN_KEY);
    })
    .finally(async () => {
      registering = false;
      if (version !== registrationVersion)
        await retryPendingPushCleanup().catch(() => {});
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
  ++registrationVersion;
  const saved = await installation();
  if (saved)
    await authStorage.setItem(
      INSTALLATION_KEY,
      JSON.stringify({ ...saved, pending: true }),
    );
  await withDeadline(
    registration.catch(() => {}),
    3_000,
  ).catch(() => {});
  if (saved) {
    await retryPendingPushCleanup();
    return;
  }
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token || !isSupabaseConfigured) return;
  const { error } = await withDeadline(
    getSupabase()!.from("push_tokens").delete().eq("token", token),
    3_000,
  );
  if (error)
    throw new Error(
      "Could not disconnect notifications. Please retry sign-out.",
    );
  await AsyncStorage.removeItem(TOKEN_KEY);
}

/** In-app notification center feed, newest first. */
export async function listNotifications(): Promise<AppNotification[]> {
  return (await listNotificationPage()).items;
}
export async function listNotificationPage(
  cursor: Cursor | null = null,
  updatesOnly = false,
): Promise<Page<AppNotification>> {
  if (useMock())
    return {
      items: mockNotifications.filter(
        (n) =>
          !updatesOnly || !["message", "plan_group_message"].includes(n.kind),
      ),
      cursor: null,
    };
  const { data, error } = await getSupabase()!.rpc("notification_cards", {
    p_limit: 40,
    p_cursor: cursor,
    p_updates_only: updatesOnly,
  });
  if (error) throw new Error(error.message);
  const page = parsePage(data);
  return {
    items: page.items.map((n) =>
      toAppNotification(n as unknown as DbNotification),
    ),
    cursor: page.cursor,
  };
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
  const { error } = await supabase.rpc("change_notice_thread", {
    p_id: id,
    p_action: "read",
  });
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
  const { error } = await supabase.rpc("change_notice_thread", {
    p_id: id,
    p_action: "unread",
  });
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
  const { error } = await supabase.rpc("change_notice_thread", {
    p_id: id,
    p_action: "delete",
  });
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
