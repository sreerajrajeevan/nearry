import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { AccountType } from '../navigation/types';

WebBrowser.maybeCompleteAuthSession();

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  accountType: AccountType;
  avatarUrl?: string;
};

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

function googleClientId() {
  // Expo Go dev uses the Expo client id; standalone builds use platform ids.
  return (
    process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    ''
  );
}

/**
 * Email/password auth. Uses Supabase when configured, otherwise mock mode
 * (any credentials succeed — for UI development only).
 */
export async function signInWithEmail(
  email: string,
  password: string,
  accountType: AccountType,
): Promise<AuthUser> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    const metaType = (data.user?.user_metadata?.account_type as AccountType) ?? accountType;
    return {
      id: data.user!.id,
      email: data.user!.email!,
      displayName: data.user!.user_metadata?.display_name ?? email.split('@')[0],
      accountType: metaType,
    };
  }
  await new Promise((r) => setTimeout(r, 800)); // simulate latency
  return {
    id: `mock-${Date.now()}`,
    email,
    displayName: email.split('@')[0],
    accountType,
  };
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
  accountType: AccountType,
): Promise<AuthUser> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName, account_type: accountType } },
    });
    if (error) throw new Error(error.message);
    return {
      id: data.user!.id,
      email: data.user!.email!,
      displayName,
      accountType,
    };
  }
  await new Promise((r) => setTimeout(r, 800));
  return { id: `mock-${Date.now()}`, email, displayName, accountType };
}

/**
 * Google OAuth via Expo AuthSession. In mock mode (no client id configured)
 * returns a mock Google user so the flow can be exercised in the UI.
 */
export async function signInWithGoogle(accountType: AccountType): Promise<AuthUser> {
  const clientId = googleClientId();
  const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });

  if (!clientId) {
    await new Promise((r) => setTimeout(r, 800));
    return {
      id: `mock-google-${Date.now()}`,
      email: 'demo.user@gmail.com',
      displayName: 'Demo User',
      accountType,
    };
  }

  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
    responseType: AuthSession.ResponseType.Code,
  });

  const result = await request.promptAsync(GOOGLE_DISCOVERY);
  if (result.type !== 'success' || !result.params.code) {
    throw new Error('Google sign-in was cancelled.');
  }

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(result.params.code);
    if (error) throw new Error(error.message);
    return {
      id: data.user.id,
      email: data.user.email!,
      displayName: data.user.user_metadata?.full_name ?? data.user.email!.split('@')[0],
      accountType,
      avatarUrl: data.user.user_metadata?.avatar_url,
    };
  }

  // No Supabase — exchange code for profile directly (dev only).
  const tokenRes = await AuthSession.exchangeCodeAsync(
    { clientId, code: result.params.code, redirectUri, extraParams: {} },
    GOOGLE_DISCOVERY,
  );
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenRes.accessToken}` },
  });
  const profile = await profileRes.json();
  return {
    id: `google-${profile.sub}`,
    email: profile.email,
    displayName: profile.name,
    accountType,
    avatarUrl: profile.picture,
  };
}

export async function signOut(): Promise<void> {
  const supabase = getSupabase();
  if (supabase) await supabase.auth.signOut();
}

export { isSupabaseConfigured };
