import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getSupabase, isSupabaseConfigured, isDemoMode } from './supabase';
import { mockNotifications } from '../data/mock';
import { AppNotification, DbNotification, toAppNotification } from './mappers';

const useMock = () => isDemoMode() || !isSupabaseConfigured;

// How local notifications behave when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Ask for permission + register this device's Expo push token. Best-effort. */
export async function registerPushToken(userId: string): Promise<void> {
  if (useMock()) return;
  try {
    if (!Device.isDevice) return;
    const { status: existing } = await Notifications.getPermissionsAsync();
    const status =
      existing === 'granted' ? existing : (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    if (!token) return;
    const supabase = getSupabase()!;
    await supabase.from('push_tokens').upsert(
      {
        user_id: userId,
        token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' },
    );
  } catch {
    // Push registration must never break the app.
  }
}

/** In-app notification center feed, newest first. */
export async function listNotifications(): Promise<AppNotification[]> {
  if (useMock()) return mockNotifications;
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return ((data ?? []) as DbNotification[]).map(toAppNotification);
}

export async function unreadNotificationCount(): Promise<number> {
  if (useMock()) return mockNotifications.filter((n) => !n.read).length;
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from('notifications')
    .select('id')
    .is('read_at', null);
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  if (useMock()) {
    const n = mockNotifications.find((x) => x.id === id);
    if (n) n.read = true;
    return;
  }
  const supabase = getSupabase()!;
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(): Promise<void> {
  if (useMock()) {
    mockNotifications.forEach((n) => {
      n.read = true;
    });
    return;
  }
  const supabase = getSupabase()!;
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) throw new Error(error.message);
}

/**
 * Remote push via the `send-push` edge function. Fire-and-forget:
 * resolves silently if the function isn't deployed yet.
 */
export async function pushToUser(userId: string, title: string, body: string): Promise<void> {
  if (useMock()) return;
  try {
    const supabase = getSupabase()!;
    await supabase.functions.invoke('send-push', { body: { user_id: userId, title, body } });
  } catch {
    /* edge function not deployed yet — in-app notification still lands */
  }
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

/** Realtime subscription for my incoming notifications. */
export function subscribeToNotifications(
  userId: string,
  onInsert: (n: AppNotification) => void,
): () => void {
  if (useMock()) return () => {};
  const supabase = getSupabase()!;
  const ch = supabase
    .channel(`notifs-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        onInsert(toAppNotification(payload.new as DbNotification));
      },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(ch);
  };
}
