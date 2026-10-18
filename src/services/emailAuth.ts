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
