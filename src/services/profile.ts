import { getSupabase, isDemoMode } from "./supabase";

export type ProfilePatch = {
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  interests?: string[];
  gender?: "male" | "female" | "other" | null;
  businessName?: string;
  businessDetails?: Record<string, unknown>;
};

/** Update the signed-in user's own profile. RLS "profiles self-update". */
export async function updateProfile(
  userId: string,
  patch: ProfilePatch,
): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.displayName !== undefined)
    dbPatch.display_name = patch.displayName.trim();
  if (patch.avatarUrl !== undefined) dbPatch.avatar_url = patch.avatarUrl;
  if (patch.bio !== undefined) dbPatch.bio = patch.bio.trim();
  if (patch.interests !== undefined) dbPatch.interests = patch.interests;
  if (patch.gender !== undefined) dbPatch.gender = patch.gender;
  if (patch.businessName !== undefined)
    dbPatch.business_name = patch.businessName.trim();
  if (patch.businessDetails !== undefined)
    dbPatch.business_details = patch.businessDetails;
  if (Object.keys(dbPatch).length === 0) return;

  if (isDemoMode()) return; // demo profile lives in AuthContext state
  const supabase = getSupabase()!;
  const { error } = await supabase
    .from("profiles")
    .update(dbPatch)
    .eq("id", userId);
  if (error) throw new Error(error.message);
}
