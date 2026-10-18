import * as ImagePicker from "expo-image-picker";
import { getSupabase } from "./supabase";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";

export type PhotoRef = { id: string; photo_url: string; sort_order: number };

/** Preset amenities businesses can pick from (plus free-form custom entries). */
export const AMENITY_PRESETS = [
  "Washroom",
  "Parking",
  "Drinking water",
  "Changing room",
  "Equipment rental",
  "First aid",
  "Cafeteria",
  "Lockers",
  "WiFi",
  "Air conditioning",
  "Power backup",
  "Seating area",
] as const;

/** Category shortcuts for the home page, mapped to venue categories. */
export const HOME_CATEGORIES = [
  { key: "dining", label: "Dining", hint: "Eat out & save", icon: "coffee" },
  { key: "movies", label: "Movies", hint: "Grab best seats", icon: "film" },
  { key: "events", label: "Events", hint: "Buy tickets", icon: "music" },
  { key: "stores", label: "Stores", hint: "Shop in-store", icon: "shopping-bag" },
  { key: "activities", label: "Activities", hint: "Try fun outings", icon: "compass" },
  { key: "play", label: "Play", hint: "Book courts", icon: "zap" },
  { key: "comedy", label: "Comedy", hint: "Catch stand-ups", icon: "smile" },
  { key: "salons", label: "Salons", hint: "Book appointment", icon: "scissors" },
] as const;

export async function pickPhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") throw new Error("Photo library permission denied.");
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.8,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0].uri;
}

/**
 * Upload a local image to the public photos bucket under <userId>/<folder>/<ts>.jpg.
 * Uses FormData — the reliable React Native file-upload path.
 */
export async function uploadPhoto(
  userId: string,
  localUri: string,
  folder: string,
): Promise<string> {
  const supabase = getSupabase()!;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in.");

  const formData = new FormData();
  formData.append("file", {
    uri: localUri,
    name: "photo.jpg",
    type: "image/jpeg",
  } as any);

  const path = `${userId}/${folder}/${Date.now()}.jpg`;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/photos/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "x-upsert": "true",
    },
    body: formData,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Upload failed: ${response.status} ${detail.slice(0, 120)}`.trim(),
    );
  }
  const { data } = supabase.storage.from("photos").getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

async function table(tableName: "venue_photos" | "post_photos") {
  return getSupabase()!.from(tableName);
}

export async function listVenuePhotos(venueId: string): Promise<PhotoRef[]> {
  const { data, error } = await (await table("venue_photos"))
    .select("id, photo_url, sort_order")
    .eq("venue_id", venueId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PhotoRef[];
}

export async function addVenuePhoto(
  venueId: string,
  photoUrl: string,
): Promise<void> {
  const existing = await listVenuePhotos(venueId);
  const { error } = await (await table("venue_photos")).insert({
    venue_id: venueId,
    photo_url: photoUrl,
    sort_order: existing.length,
  });
  if (error) throw new Error(error.message);
}

export async function deleteVenuePhoto(id: string): Promise<void> {
  const { error } = await (await table("venue_photos")).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listPostPhotos(postId: string): Promise<PhotoRef[]> {
  const { data, error } = await (await table("post_photos"))
    .select("id, photo_url, sort_order")
    .eq("post_id", postId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PhotoRef[];
}

export async function addPostPhoto(
  postId: string,
  photoUrl: string,
): Promise<void> {
  const existing = await listPostPhotos(postId);
  const { error } = await (await table("post_photos")).insert({
    post_id: postId,
    photo_url: photoUrl,
    sort_order: existing.length,
  });
  if (error) throw new Error(error.message);
}

export async function deletePostPhoto(id: string): Promise<void> {
  const { error } = await (await table("post_photos")).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Spotlight offers: live, flagged, with a cover photo, newest first. */
export async function listSpotlightOffers(limit = 10): Promise<
  { id: string; title: string; cover_photo_url: string | null; business_id: string }[]
> {
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from("offers")
    .select("id, title, cover_photo_url, business_id")
    .eq("status", "live")
    .eq("is_spotlight", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as {
    id: string;
    title: string;
    cover_photo_url: string | null;
    business_id: string;
  }[];
}
