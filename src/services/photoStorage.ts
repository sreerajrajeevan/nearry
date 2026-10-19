import { requireSupabase } from "./supabase";
import { proofImageType } from "../utils/proofImage";

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/** Upload actual bytes with their real MIME type, never a multipart URI object. */
export async function uploadPhotoBytes(
  userId: string,
  bytes: Uint8Array,
  folder: string,
): Promise<string> {
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES)
    throw new Error("Choose a photo smaller than 10 MB.");
  if (!/^[a-zA-Z0-9-]+$/.test(userId) || !/^[a-zA-Z0-9-]+$/.test(folder))
    throw new Error("Invalid photo destination.");
  const { extension, contentType } = proofImageType(bytes);
  const path = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const bucket = requireSupabase().storage.from("photos");
  const { error } = await bucket.upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(`Could not upload photo: ${error.message}`);
  return bucket.getPublicUrl(path).data.publicUrl;
}
