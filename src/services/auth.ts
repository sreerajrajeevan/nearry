import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { requireSupabase } from "./supabase";
import { AccountType } from "../navigation/types";

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

export type OtpChannel = "signup" | "login";

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
  signup = true,
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      ...accountTypeMeta(accountType, displayName),
      shouldCreateUser: signup,
    },
  });
  if (error) throw new Error(friendlyAuthError(error.message));
}

/** Step 2: verify the 6-digit code. Returns the authenticated user id. */
export async function verifyEmailOtp(
  email: string,
  code: string,
): Promise<string> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: "email",
  });
  if (error) throw new Error(friendlyAuthError(error.message));
  if (!data.user)
    throw new Error("Verification succeeded but no user was returned.");
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
export async function signInWithGoogle(
  accountType: AccountType,
): Promise<string> {
  const supabase = requireSupabase();
  const redirectTo = Linking.createURL("auth/callback");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });
  if (error) throw new Error(friendlyAuthError(error.message));
  if (!data.url) throw new Error("Could not start Google sign-in.");

  await AsyncStorage.setItem("nearry.pendingRole", accountType);
  if (Platform.OS === "web") {
    window.location.assign(data.url);
    return "";
  }
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== "success" || !res.url)
    throw new Error("Google sign-in was cancelled.");
  const userId = await completeOAuthCallback(res.url);
  if (!userId)
    throw new Error("Google sign-in completed without an auth code.");
  return userId;
}

const exchanges = new Map<string, Promise<string>>();
export async function completeOAuthCallback(
  url: string,
): Promise<string | null> {
  const expected = Linking.createURL("auth/callback").split("?")[0];
  if (url.split("?")[0].split("#")[0] !== expected) return null;
  const detail =
    extractParam(url, "error_description") || extractParam(url, "error");
  if (detail) {
    clearWebCallback(url);
    throw new Error(`Google sign-in failed: ${detail}`);
  }
  const code = extractParam(url, "code");
  if (!code) return null;
  if (!exchanges.has(code)) {
    const promise = requireSupabase()
      .auth.exchangeCodeForSession(code)
      .then(({ data, error }) => {
        if (error) throw new Error(friendlyAuthError(error.message));
        if (!data.user) throw new Error("No authenticated user was returned.");
        return data.user.id;
      });
    exchanges.set(code, promise);
    void promise.catch(() => exchanges.delete(code));
  }
  try {
    return await exchanges.get(code)!;
  } finally {
    clearWebCallback(url);
  }
}

export async function signOut(): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

function extractParam(url: string, name: string): string | null {
  try {
    return new URL(url).searchParams.get(name);
  } catch {
    const m = new RegExp(`[?&#]${name}=([^&#]+)`).exec(url);
    return m ? decodeURIComponent(m[1]) : null;
  }
}

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid") && m.includes("otp"))
    return "That code is incorrect or expired.";
  if (m.includes("expired"))
    return "That code has expired — request a new one.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts — wait a minute and try again.";
  if (m.includes("provider") && m.includes("not enabled"))
    return "Google sign-in is not enabled yet.";
  if (m.includes("signup") && m.includes("not allowed"))
    return "No account found for this email. If you're new, create an account below.";
  return message;
}

/** Remove consumed credentials so a browser reload cannot replay the callback. */
function clearWebCallback(callbackUrl: string) {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  const current = new URL(window.location.href);
  if (current.href !== callbackUrl) return;
  for (const name of ["code", "error", "error_description", "error_code"])
    current.searchParams.delete(name);
  window.history.replaceState(
    window.history.state,
    "",
    current.pathname + current.search + current.hash,
  );
}
