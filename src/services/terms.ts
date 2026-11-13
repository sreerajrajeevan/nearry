import { requireSupabase } from "./supabase";
import { POLICY_VERSION } from "../utils/legal";

export const AGREEMENT_REQUIRED =
  "Please confirm you’re 18 or older and agree to the Terms & Community Guidelines.";

/** The database records the authenticated account, policy version and server timestamp. */
export async function acceptCurrentTerms(expectedUserId?: string) {
  const db = requireSupabase();
  if (expectedUserId) {
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    if (data.session?.user.id !== expectedUserId)
      throw new Error("Account changed. Please retry.");
  }
  const { error } = await db.rpc("accept_community_terms", {
    p_version: POLICY_VERSION,
    p_adult: true,
  });
  if (error) throw error;
}
