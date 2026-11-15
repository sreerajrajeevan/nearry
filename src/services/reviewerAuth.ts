import { requireSupabase } from "./supabase";
import {
  isReviewerEmail,
  reviewerLoginEnabled,
} from "../utils/authAvailability";

/** Standard Supabase password authentication for provisioned review accounts.
 * This does not bypass authentication, role selection, RLS or verification.
 * Passwords are provided privately in Play Console, never embedded in the app.
 */
export async function signInReviewer(
  email: string,
  password: string,
): Promise<void> {
  if (!reviewerLoginEnabled || !isReviewerEmail(email) || !password)
    throw new Error("Enter the review credentials supplied with this build.");
  const { error } = await requireSupabase().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error)
    throw new Error(
      "Could not sign in. Check the review credentials and try again.",
    );
}
