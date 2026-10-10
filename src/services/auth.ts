import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { requireSupabase } from './supabase';
import { AccountType } from '../navigation/types';

WebBrowser.maybeCompleteAuthSession();

/**
 * Authentication — Supabase only.
 *
 * - Email: passwordless OTP (6-digit code). No passwords, no phone numbers.
 * - Google: OAuth *through Supabase* (Supabase handles the Google exchange;
 *   the app only opens the provider URL and completes the PKCE/code flow).
 *
 * There is intentionally no mock fallback here. When the backend is not
 * configured these functions throw; the UI must route to explicit demo mode.
 */

export type OtpChannel = 'signup' | 'login';

function accountTypeMeta(accountType: AccountType, displayName?: string) {
  return {
    data: {
      account_type: accountType,
      ...(displayName ? { display_name: displayName } : {}),
    },
  };
}

/** Step 1: send a 6-digit code to the email. Creates the user on first use. */
export async function sendEmailOtp(
  email: string,
  accountType: AccountType,
  displayName?: string,
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: accountTypeMeta(accountType, displayName),
  });
  if (error) throw new Error(error.message);
}

/** Step 2: verify the 6-digit code. Returns the authenticated user id. */
export async function verifyEmailOtp(email: string, code: string): Promise<string> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'email',
  });
  if (error) throw new Error(friendlyAuthError(error.message));
  if (!data.user) throw new Error('Verification succeeded but no user was returned.');
  return data.user.id;
}

/**
 * Google sign-in through Supabase.
 *
 * Requires the Google provider to be enabled in the Supabase dashboard
 * (Auth → Providers → Google) with a Google Cloud OAuth client, and the
 * redirect URL `nearry://auth/callback` allow-listed under
 * Auth → URL Configuration → Redirect URLs.
 */
export async function signInWithGoogle(accountType: AccountType): Promise<string> {
  const supabase = requireSupabase();
  const redirectTo = Linking.createURL('auth/callback');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) throw new Error(friendlyAuthError(error.message));
  if (!data.url) throw new Error('Could not start Google sign-in.');

  // Stash the intended account type so a brand-new Google user lands in the
  // right onboarding. Applied to user_metadata on first session below.
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success' || !res.url) {
    throw new Error('Google sign-in was cancelled.');
  }

  const code = extractCode(res.url);
  if (!code) throw new Error('Google sign-in completed without an auth code.');

  const { data: sessionData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw new Error(friendlyAuthError(exchangeError.message));

  const userId = sessionData.user?.id;
  if (!userId) throw new Error('Google sign-in completed without a user.');

  // First-time Google users get no user_metadata from the OAuth dance above,
  // so stamp the chosen account type for the profile trigger / routing.
  const meta = sessionData.user?.user_metadata ?? {};
  if (!meta.account_type) {
    await supabase.auth.updateUser({ data: { ...meta, account_type: accountType } });
  }
  return userId;
}

export async function signOut(): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

function extractCode(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('code');
  } catch {
    const m = /[?&#]code=([^&#]+)/.exec(url);
    return m ? decodeURIComponent(m[1]) : null;
  }
}

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid') && m.includes('otp')) return 'That code is incorrect or expired.';
  if (m.includes('expired')) return 'That code has expired — request a new one.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts — wait a minute and try again.';
  if (m.includes('provider') && m.includes('not enabled')) return 'Google sign-in is not enabled yet.';
  return message;
}
