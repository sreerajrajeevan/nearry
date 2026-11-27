import { requireSupabase } from "./supabase";
import { proofImageType } from "../utils/proofImage";

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/** Upload actual bytes with their real MIME type, never a multipart URI object. */
export async function uploadPhotoBytes(
  userId: string,
  bytes: Uint8Array,
  folder: string,
  thumbnail?: Uint8Array,
): Promise<string> {
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES)
    throw new Error("Choose a photo smaller than 10 MB.");
  if (!/^[a-zA-Z0-9-]+$/.test(userId) || !/^[a-zA-Z0-9-]+$/.test(folder))
    throw new Error("Invalid photo destination.");
  const { extension, contentType } = proofImageType(bytes);
  if (thumbnail) {
    if (
      thumbnail.length > MAX_PHOTO_BYTES ||
      proofImageType(thumbnail).extension !== "jpg" ||
      extension !== "jpg"
    )
      throw new Error("Could not prepare the photo preview.");
  }
  const path = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}${thumbnail ? "-full" : ""}.${extension}`;
  const bucket = requireSupabase().storage.from("photos");
  const thumbPath = thumbnail
    ? path.replace(/-full\.jpg$/, "-thumb.jpg")
    : null;
  if (thumbnail && thumbPath) {
    const { error } = await bucket.upload(thumbPath, thumbnail, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (error)
      throw new Error("Could not upload the photo preview. Please retry.");
  }
  const { error } = await bucket.upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (error) {
    if (thumbPath) void bucket.remove([thumbPath]).catch(() => {});
    throw new Error(`Could not upload photo: ${error.message}`);
  }
  return bucket.getPublicUrl(path).data.publicUrl;
}

/** Storage paths (photo and its thumbnail) behind a public photo URL. */
export function uploadedPhotoPaths(url: string): string[] {
  const match = /\/storage\/v1\/object\/public\/photos\/([^?#]+)$/.exec(url);
  if (!match) return [];
  const path = decodeURIComponent(match[1]);
  return /-full\.jpg$/.test(path)
    ? [path, path.replace(/-full\.jpg$/, "-thumb.jpg")]
    : [path];
}

/**
 * Delete a photo the host uploaded but replaced or removed before saving.
 * Best effort: the daily cleanup removes anything left unattached.
 */
export async function removeUploadedPhoto(url: string): Promise<void> {
  const paths = uploadedPhotoPaths(url);
  if (!paths.length) return;
  await requireSupabase().storage.from("photos").remove(paths);
}
