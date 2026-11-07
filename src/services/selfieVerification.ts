import { proofImageType } from "../utils/proofImage";
import { getSupabase, isDemoMode } from "./supabase";
export type SelfieReviewStatus =
  "unverified" | "pending" | "verified" | "rejected";
export type SelfieReview = {
  status: SelfieReviewStatus;
  note?: string;
  submittedAt?: string;
  reviewedAt?: string;
};
/** Google/external avatar URLs must first be uploaded as a Nearry profile photo. */
export function hasSelfieComparisonAvatar(
  userId: string,
  avatarUrl?: string,
): boolean {
  try {
    const base = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL || "");
    const avatar = new URL(avatarUrl || "");
    const prefix = `/storage/v1/object/public/avatars/${userId}/`;
    return (
      base.protocol === "https:" &&
      avatar.origin === base.origin &&
      avatar.pathname.startsWith(prefix) &&
      /^avatar-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/.test(
        avatar.pathname.slice(prefix.length),
      )
    );
  } catch {
    return false;
  }
}
export async function getMySelfieReview(userId: string): Promise<SelfieReview> {
  if (isDemoMode()) return { status: "unverified" };
  const db = getSupabase();
  if (!db) throw new Error("Selfie review requires a configured backend.");
  const { data, error } = await db
    .from("personal_selfie_reviews")
    .select("status,note,submitted_at,reviewed_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data
    ? {
        status: data.status,
        note: data.note ?? undefined,
        submittedAt: data.submitted_at ?? undefined,
        reviewedAt: data.reviewed_at ?? undefined,
      }
    : { status: "unverified" };
}
/** Other members receive one checked/not-checked value, never photos or notes. */
export async function isPersonalSelfieChecked(
  userId: string,
): Promise<boolean> {
  if (isDemoMode()) return false;
  const db = getSupabase();
  if (!db) return false;
  const { data, error } = await db.rpc("is_personal_selfie_checked", {
    p_user: userId,
  });
  if (error) throw new Error(error.message);
  return data === true;
}
export async function withdrawPersonalSelfie(): Promise<void> {
  if (isDemoMode())
    throw new Error("Selfie review is unavailable in demo mode.");
  const { error } = await getSupabase()!.rpc("withdraw_personal_selfie");
  if (error) throw new Error(error.message);
}
/** Bytes are normalized on device; the private bucket and RPC enforce ownership. */
export async function submitSelfieImage(
  userId: string,
  bytes: Uint8Array,
): Promise<void> {
  if (isDemoMode())
    throw new Error("Selfie review is unavailable in demo mode.");
  const db = getSupabase();
  if (!db) throw new Error("Selfie review requires a configured backend.");
  if (!bytes.length || bytes.length > 5 * 1024 * 1024)
    throw new Error("Please take a selfie smaller than 5 MB.");
  const { extension, contentType } = proofImageType(bytes);
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError || user?.id !== userId)
    throw new Error("Please sign in again.");
  const name = `${userId}/selfie-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const storage = db.storage.from("selfie_proofs");
  const { error: uploadError } = await storage.upload(name, bytes, {
    contentType,
    upsert: false,
  });
  if (uploadError)
    throw new Error("Private selfie upload failed. Please try again.");
  const { error } = await db.rpc("submit_personal_selfie", {
    p_path: name,
    p_consent: true,
  });
  if (error) {
    // RLS prevents deletion if the submission committed but its response was lost.
    // Other abandoned uploads expire through the existing maintenance worker.
    await storage.remove([name]).catch(() => {});
    throw new Error(error.message);
  }
}
