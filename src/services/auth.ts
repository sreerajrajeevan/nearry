import { completeSignupAgreement } from "./terms";
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

export { sendEmailOtp, verifyEmailOtp } from "./emailAuth";
import { friendlyAuthError } from "../utils/authError";

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
      .then(async ({ data, error }) => {
        if (error) throw new Error(friendlyAuthError(error.message));
        if (!data.user) throw new Error("No authenticated user was returned.");
        await completeSignupAgreement("google", data.user.id);
        return data.user.id;
      });
    exchanges.set(code, promise);
    void promise.then(
      () => exchanges.delete(code),
      () => exchanges.delete(code),
    );
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
