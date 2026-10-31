import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { proofImageType } from "../utils/proofImage";
import { getSupabase, isDemoMode } from "./supabase";

export type SelfieReviewStatus = "unverified" | "pending" | "verified" | "rejected";
export type SelfieReview = {
  status: SelfieReviewStatus;
  note?: string;
  submittedAt?: string;
  reviewedAt?: string;
};

function base64ToBytes(b64: string): Uint8Array {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const a = chars.indexOf(clean[i]), b = chars.indexOf(clean[i + 1]);
    const c = chars.indexOf(clean[i + 2]), d = chars.indexOf(clean[i + 3]);
    bytes.push((a << 2) | (b >> 4));
    if (c !== 64) bytes.push(((b & 15) << 4) | (c >> 2));
    if (d !== 64) bytes.push(((c & 3) << 6) | d);
  }
  return new Uint8Array(bytes);
}

export async function getMySelfieReview(userId: string): Promise<SelfieReview> {
  if (isDemoMode()) return { status: "unverified" };
  const db = getSupabase();
  if (!db) throw new Error("Selfie verification requires a configured backend.");
  const { data, error } = await db.from("personal_selfie_reviews")
    .select("status,note,submitted_at,reviewed_at")
    .eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data
    ? { status: data.status as SelfieReviewStatus,
        note: data.note ?? undefined,
        submittedAt: data.submitted_at ?? undefined,
        reviewedAt: data.reviewed_at ?? undefined }
    : { status: "unverified" };
}

/** Exposes a reviewer-approved result only; never photos or review notes. */
export async function isPersonalSelfieChecked(userId: string): Promise<boolean> {
  if (isDemoMode()) return false;
  const db = getSupabase();
  if (!db) return false;
  const { data, error } = await db.rpc("is_personal_selfie_checked", {
    p_user: userId,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

/** Upload camera capture to private Storage, then atomically submit for review. */
export async function submitPersonalSelfie(userId: string, uri: string): Promise<void> {
  if (isDemoMode()) throw new Error("Selfie verification is unavailable in demo mode.");
  if (Platform.OS === "web") throw new Error("Use the Nearry phone app to take your selfie.");
  const db = getSupabase();
  if (!db) throw new Error("Selfie verification requires a configured backend.");
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || user?.id !== userId) throw new Error("Please sign in again.");

  const data = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = base64ToBytes(data);
  if (!bytes.length || bytes.length > 5 * 1024 * 1024)
    throw new Error("Please take a selfie smaller than 5 MB.");
  const { extension, contentType } = proofImageType(bytes);
  const path = `${userId}/selfie-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const storage = db.storage.from("selfie_proofs");
  const { error: uploadError } = await storage.upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (uploadError) throw new Error(`Private selfie upload failed: ${uploadError.message}`);
  const { error: reviewError } = await db.rpc("submit_personal_selfie", {
    p_path: path,
    p_consent: true,
  });
  if (reviewError) {
    await storage.remove([path]).catch(() => {});
    throw new Error(reviewError.message);
  }
}
