import { assertLive } from "./demoGuard";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { withDeadline } from "../utils/deadline";
import { Image, Platform } from "react-native";
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

export async function pickPhoto(
  options: { allowsEditing?: boolean } = {},
): Promise<string | null> {
  // The system picker grants access to the chosen item. Do not require broad
  // library permission or await a permission prompt before a web user gesture.
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: options.allowsEditing ?? true,
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
  const size = await withDeadline(
    new Promise<{ width: number; height: number }>((resolve, reject) =>
      Image.getSize(
        localUri,
        (width, height) => resolve({ width, height }),
        reject,
      ),
    ),
    10_000,
    "Could not read this photo. Please choose it again.",
  );
  const resize = (max: number) =>
    Math.max(size.width, size.height) > max
      ? [
          {
            resize:
              size.width >= size.height ? { width: max } : { height: max },
          },
        ]
      : [];
  const normalized = await withDeadline(
    ImageManipulator.manipulateAsync(localUri, resize(1600), {
      compress: 0.82,
      format: ImageManipulator.SaveFormat.JPEG,
    }),
    30_000,
    "Could not prepare this photo. Try a smaller image.",
  );
  let thumbnail: { uri: string } | undefined;
  const read = async (uri: string) => {
    if (Platform.OS === "web") {
      const response = await withDeadline(
        fetch(uri),
        10_000,
        "Could not read this photo.",
      );
      if (!response.ok) throw new Error("Choose the photo again.");
      return new Uint8Array(
        await withDeadline(
          response.arrayBuffer(),
          10_000,
          "Could not read this photo.",
        ),
      );
    }
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || info.size > MAX_PHOTO_BYTES)
      throw new Error("Choose a photo smaller than 10 MB.");
    return imageBytesFromBase64(
      await withDeadline(
        FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        }),
        10_000,
        "Could not read this photo.",
      ),
    );
  };
  try {
    thumbnail = await withDeadline(
      ImageManipulator.manipulateAsync(
        normalized.uri,
        [
          {
            resize:
              normalized.width >= normalized.height
                ? { width: Math.min(640, normalized.width) }
                : { height: Math.min(640, normalized.height) },
          },
        ],
        { compress: 0.76, format: ImageManipulator.SaveFormat.JPEG },
      ),
      20_000,
      "Could not prepare this photo.",
    );
    return await uploadPhotoBytes(
      userId,
      await read(normalized.uri),
      folder,
      await read(thumbnail.uri),
    );
  } finally {
    if (Platform.OS !== "web")
      for (const uri of new Set([normalized.uri, thumbnail?.uri]))
        if (uri && uri !== localUri)
          void FileSystem.deleteAsync(uri, { idempotent: true }).catch(
            () => {},
          );
  }
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
  assertLive("upload photos");
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
  assertLive("delete photos");
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
