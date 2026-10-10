import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * True when real Supabase credentials are present.
 * When false, real auth/data calls throw — the app must use explicit demo mode.
 */
export const isSupabaseConfigured = url.length > 0 && anonKey.length > 0;

let client: SupabaseClient | null = null;

/**
 * Explicit demo mode. When on, services serve mock data. This is only ever
 * set from AuthContext.enterDemoMode() — i.e. the user explicitly chose the
 * demo. Real auth/data paths never consult it as a fallback.
 */
let demoMode = false;
export function setDemoMode(on: boolean) {
  demoMode = on;
}
export function isDemoMode() {
  return demoMode;
}

/** Returns the shared client, or null when the backend is not configured. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        // In React Native the OAuth redirect is handled manually via
        // expo-web-browser; never let the client swallow the URL.
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

/**
 * Returns the configured client, or throws a clear error.
 * Real auth/data paths must call this — never silently fall back to mock.
 */
export function requireSupabase(): SupabaseClient {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error(
      'Backend not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, or use demo mode.',
    );
  }
  return supabase;
}
