import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";
import { getSupabase, isDemoMode } from "./supabase";
import { imageBytesFromBase64 } from "../utils/imageBytes";
import { MAX_PHOTO_BYTES, uploadPhotoBytes } from "./photoStorage";
import type { PhotoRef } from "./postPhotos";
export { listPostPhotos, addPostPhoto, deletePostPhoto } from "./postPhotos";
export type { PhotoRef } from "./postPhotos";

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
  {
    key: "stores",
    label: "Stores",
    hint: "Shop in-store",
    icon: "shopping-bag",
  },
  {
    key: "activities",
    label: "Activities",
    hint: "Try fun outings",
    icon: "compass",
  },
  { key: "play", label: "Play", hint: "Book courts", icon: "zap" },
  { key: "comedy", label: "Comedy", hint: "Catch stand-ups", icon: "smile" },
  {
    key: "salons",
    label: "Salons",
    hint: "Book appointment",
    icon: "scissors",
  },
] as const;

export async function pickPhoto(): Promise<string | null> {
  // The system picker grants access to the chosen item. Do not require broad
  // library permission or await a permission prompt before a web user gesture.
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    quality: 0.8,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const photo = result.assets[0];
  if (photo.fileSize && photo.fileSize > MAX_PHOTO_BYTES)
    throw new Error("Choose a photo smaller than 10 MB.");
  return photo.uri;
}

/**
 * Read native files as bytes and web blob/data URIs as ArrayBuffers.
 * SDK upload supplies the API key and current auth token on both platforms.
 */
export async function uploadPhoto(
  userId: string,
  localUri: string,
  folder: string,
): Promise<string> {
  if (isDemoMode()) return localUri;
  const supabase = getSupabase();
  if (!supabase) throw new Error("Photo upload needs the backend configured.");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session || session.user.id !== userId)
    throw new Error("Sign in again to upload photos.");
  let bytes: Uint8Array;
  if (Platform.OS === "web") {
    const response = await fetch(localUri);
    if (!response.ok)
      throw new Error("Could not read this photo. Please choose it again.");
    bytes = new Uint8Array(await response.arrayBuffer());
  } else {
    const info = await FileSystem.getInfoAsync(localUri);
    if (info.exists && info.size > MAX_PHOTO_BYTES)
      throw new Error("Choose a photo smaller than 10 MB.");
    bytes = imageBytesFromBase64(
      await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      }),
    );
  }
  return uploadPhotoBytes(userId, bytes, folder);
}

async function table(tableName: "venue_photos" | "post_photos") {
  return getSupabase()!.from(tableName);
}

export async function listVenuePhotos(venueId: string): Promise<PhotoRef[]> {
  if (isDemoMode()) return [];
  const { data, error } = await (
    await table("venue_photos")
  )
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
  const { error } = await (
    await table("venue_photos")
  ).insert({
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

/** Spotlight offers: live, flagged, with a cover photo, newest first. */
export async function listSpotlightOffers(limit = 10): Promise<
  {
    id: string;
    title: string;
    cover_photo_url: string | null;
    business_id: string;
  }[]
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
