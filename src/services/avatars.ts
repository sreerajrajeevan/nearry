import * as ImagePicker from "expo-image-picker";
import { getSupabase } from "./supabase";

/** Pick a square-cropped image from the library. Returns the local URI or null. */
export async function pickAvatar(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") throw new Error("Photo access is needed to set a profile picture.");
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0].uri;
}

/**
 * Upload a local image URI to the public avatars bucket under <userId>/avatar.jpg
 * and return the public URL.
 */
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const supabase = getSupabase()!;
  const response = await fetch(localUri);
  const blob = await response.blob();
  const path = `${userId}/avatar.jpg`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  // Cache-bust so a re-upload shows immediately.
  return `${data.publicUrl}?t=${Date.now()}`;
}
