import { normalizeEmail, normalizeEmailCode } from "../utils/emailSignIn";
import { requireSupabase } from "./supabase";
import type { AccountType } from "../navigation/types";
import { friendlyAuthError } from "../utils/authError";

export type OtpChannel = "signup" | "login";

function accountTypeMeta(accountType: AccountType, displayName?: string) {
  return {
    data: {
      account_type: accountType,
      ...(displayName ? { display_name: displayName } : {}),
    },
  };
}

/** Step 1: request an email code. Only signup permits account creation. */
export async function sendEmailOtp(
  email: string,
  accountType: AccountType,
  displayName?: string,
  signup = true,
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email: normalizeEmail(email),
    options: {
      ...accountTypeMeta(accountType, displayName),
      shouldCreateUser: signup,
    },
  });
  if (error) throw new Error(friendlyAuthError(error.message, error.code));
}

/** Step 2: verify the complete email code. Returns the authenticated user id. */
export async function verifyEmailOtp(
  email: string,
  code: string,
): Promise<string> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.verifyOtp({
    email: normalizeEmail(email),
    token: normalizeEmailCode(code),
    type: "email",
  });
  if (error) throw new Error(friendlyAuthError(error.message, error.code));
  if (!data.user)
    throw new Error("Verification succeeded but no user was returned.");
  return data.user.id;
}
