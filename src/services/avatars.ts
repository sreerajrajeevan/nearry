import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import { getSupabase } from "./supabase";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";

/** Pick a square-cropped image from the library. Returns the local URI or null. */
export async function pickAvatar(): Promise<string | null> {
  // The system picker grants access to the selected photo without broad library permission.
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
 * Upload a local image URI to the public avatars bucket under a unique immutable <userId>/avatar-<uuid>.jpg path
 * and return the public URL.
 *
 * Uses FormData with the file URI directly against the Storage REST API.
 * supabase-js's Blob upload path fails on device ("Network request failed");
 * FormData is React Native's native file-upload mechanism and works reliably.
 */
export async function uploadAvatar(
  userId: string,
  localUri: string,
): Promise<string> {
  const supabase = getSupabase()!;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session || session.user.id !== userId) throw new Error("Not signed in.");
  const normalized = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1024 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );

  try {
    const formData = new FormData();
    formData.append("file", {
      uri: normalized.uri,
      name: "avatar.jpg",
      type: "image/jpeg",
    } as any);

    const path = `${userId}/avatar-${Crypto.randomUUID()}.jpg`;
    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/avatars/${path}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "x-upsert": "false",
        },
        body: formData,
      },
    );
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Upload failed: ${response.status} ${detail.slice(0, 120)}`.trim(),
      );
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return data.publicUrl;
  } finally {
    await FileSystem.deleteAsync(normalized.uri, { idempotent: true }).catch(
      () => {},
    );
  }
}
