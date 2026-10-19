import { getSupabase, isDemoMode } from "./supabase";

export type PhotoRef = { id: string; photo_url: string; sort_order: number };
export const MAX_POST_PHOTOS = 5;
const demoPhotos = new Map<string, PhotoRef[]>();

export async function listPostPhotos(postId: string): Promise<PhotoRef[]> {
  if (isDemoMode()) return [...(demoPhotos.get(postId) ?? [])];
  const { data, error } = await getSupabase()!
    .from("post_photos")
    .select("id, photo_url, sort_order")
    .eq("post_id", postId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PhotoRef[];
}

/** One batch for feed thumbnails, rather than a request for each post. */
export async function postPhotoCovers(
  postIds: string[],
): Promise<Map<string, string>> {
  const covers = new Map<string, string>();
  if (!postIds.length) return covers;
  if (isDemoMode()) {
    for (const id of postIds) {
      const first = demoPhotos.get(id)?.[0];
      if (first) covers.set(id, first.photo_url);
    }
    return covers;
  }
  // Keep requests below URL limits when a host has a large post history.
  for (let start = 0; start < postIds.length; start += 100) {
    const { data, error } = await getSupabase()!
      .from("post_photos")
      .select("post_id, photo_url, sort_order")
      .in("post_id", postIds.slice(start, start + 100))
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    for (const row of data ?? [])
      if (!covers.has(row.post_id)) covers.set(row.post_id, row.photo_url);
  }
  return covers;
}

export async function addPostPhoto(
  postId: string,
  photoUrl: string,
): Promise<void> {
  const existing = await listPostPhotos(postId);
  // A retry after a lost response must not attach the same uploaded photo twice.
  if (existing.some((photo) => photo.photo_url === photoUrl)) return;
  if (existing.length >= MAX_POST_PHOTOS)
    throw new Error("A post can have up to 5 photos.");
  if (isDemoMode()) {
    demoPhotos.set(postId, [
      ...existing,
      {
        id: `demo-photo-${Date.now()}-${existing.length}`,
        photo_url: photoUrl,
        sort_order: existing.length,
      },
    ]);
    return;
  }
  const sortOrder =
    Math.max(-1, ...existing.map((photo) => photo.sort_order)) + 1;
  const { error } = await getSupabase()!.from("post_photos").insert({
    post_id: postId,
    photo_url: photoUrl,
    sort_order: sortOrder,
  });
  if (error) throw new Error(error.message);
}

export async function deletePostPhoto(id: string): Promise<void> {
  if (isDemoMode()) {
    for (const [postId, photos] of demoPhotos)
      demoPhotos.set(
        postId,
        photos.filter((photo) => photo.id !== id),
      );
    return;
  }
  const { error } = await getSupabase()!
    .from("post_photos")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export type PendingPostPhoto = { uri: string; uploadedUrl?: string };

/** Preserve successful uploads and the unsaved attachments across retries. */
export async function savePostPhotos(
  postId: string,
  photos: PendingPostPhoto[],
  upload: (uri: string) => Promise<string>,
  attach: (postId: string, url: string) => Promise<void> = addPostPhoto,
): Promise<{ pending: PendingPostPhoto[]; error: string }> {
  const pending: PendingPostPhoto[] = [];
  let error = "";
  // Stop at the first failure to preserve the host's chosen cover/order.
  for (let index = 0; index < photos.length; index++) {
    const photo = { ...photos[index] };
    try {
      photo.uploadedUrl ??= await upload(photo.uri);
      await attach(postId, photo.uploadedUrl);
    } catch (e) {
      pending.push(photo, ...photos.slice(index + 1));
      error = e instanceof Error ? e.message : "Please try again.";
      break;
    }
  }
  return { pending, error };
}
