import { assertLive } from "./demoGuard";
import { getSupabase, isDemoMode } from "./supabase";

export type PublicProfile = {
  id: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
};

/**
 * What anyone may see about another person: name, photo and bio. Age, gender
 * and interests stay private (the database only grants these columns).
 */
export async function getPublicProfile(
  userId: string,
  fallbackName = "Someone",
): Promise<PublicProfile> {
  const supabase = getSupabase();
  if (isDemoMode() || !supabase)
    return { id: userId, displayName: fallbackName };
  const { data, error } = await supabase
    .from("profiles")
    .select("id,display_name,avatar_url,bio")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("This profile is no longer available.");
  return {
    id: data.id,
    displayName: data.display_name || fallbackName,
    ...(data.avatar_url ? { avatarUrl: data.avatar_url } : {}),
    ...(data.bio?.trim() ? { bio: data.bio.trim() } : {}),
  };
}

/** Optional public avatar URLs only, batched to avoid one profile request per feed card. */
export async function publicAvatars(
  userIds: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const supabase = getSupabase();
  if (isDemoMode() || !supabase) return result;
  const ids = [...new Set(userIds)];
  for (let start = 0; start < ids.length; start += 100) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, avatar_url")
      .in("id", ids.slice(start, start + 100));
    if (error) throw new Error(error.message);
    for (const row of data ?? [])
      if (row.avatar_url) result.set(row.id, row.avatar_url);
  }
  return result;
}

export type ProfilePatch = {
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  interests?: string[];
  gender?: "male" | "female" | "other" | null;
  age?: number | null;
  businessName?: string;
  businessDetails?: Record<string, unknown>;
};

/** Update the signed-in user's own profile. RLS "profiles self-update". */
export async function updateProfile(
  userId: string,
  patch: ProfilePatch,
): Promise<void> {
  assertLive("edit your profile");
  const dbPatch: Record<string, unknown> = {};
  if (patch.displayName !== undefined)
    dbPatch.display_name = patch.displayName.trim();
  if (patch.avatarUrl !== undefined) dbPatch.avatar_url = patch.avatarUrl;
  if (patch.bio !== undefined) dbPatch.bio = patch.bio.trim();
  if (patch.interests !== undefined) dbPatch.interests = patch.interests;
  if (patch.gender !== undefined) dbPatch.gender = patch.gender;
  if (patch.age !== undefined) dbPatch.age = patch.age;
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

/** Server validates adulthood, required fields, role and explicit current agreement. */
export async function completePersonalProfile(input: {
  displayName: string;
  gender: "male" | "female" | "other";
  age: number;
  termsAccepted: boolean;
}): Promise<void> {
  assertLive("edit your profile");
  const { error } = await getSupabase()!.rpc("complete_personal_profile", {
    p_display_name: input.displayName,
    p_gender: input.gender,
    p_age: input.age,
    p_terms_accepted: input.termsAccepted,
  });
  if (error) throw new Error(error.message);
}
