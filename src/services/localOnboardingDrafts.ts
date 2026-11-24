import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { OnboardingDraftStore } from "./onboardingDrafts";

export const onboardingDrafts = new OnboardingDraftStore(AsyncStorage);
const photoFolder = (id: string) =>
  FileSystem.documentDirectory
    ? `${FileSystem.documentDirectory}onboarding-drafts/${encodeURIComponent(id)}/`
    : null;

/** Keep the confirmed crop in app-private files rather than a disposable picker cache. */
export async function keepOnboardingPhoto(
  id: string,
  uri: string,
): Promise<string> {
  if (Platform.OS === "web") {
    if (uri.length > 2_000_000)
      throw new Error("Choose a smaller profile photo.");
    // Blob URLs die on reload. Convert only the user-selected local image, never a remote URL.
    if (!uri.startsWith("blob:")) return uri;
    const response = await fetch(uri);
    const blob = await response.blob();
    if (blob.size > 1_400_000)
      throw new Error("Choose a smaller profile photo.");
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === "string"
          ? resolve(reader.result)
          : reject(new Error("Could not save your photo."));
      reader.onerror = () => reject(new Error("Could not save your photo."));
      reader.readAsDataURL(blob);
    });
  }
  const folder = photoFolder(id);
  if (!folder)
    throw new Error(
      "Could not save your photo on this device. Please try again.",
    );
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
  const target = `${folder}${Crypto.randomUUID()}.jpg`;
  await FileSystem.copyAsync({ from: uri, to: target });
  return target;
}

export async function clearOnboardingPhotoFiles(id: string) {
  const folder = Platform.OS === "web" ? null : photoFolder(id);
  if (folder) await FileSystem.deleteAsync(folder, { idempotent: true });
}

export async function clearOnboardingDrafts(id: string) {
  // Invalidate writers immediately; file cleanup must not allow a late draft write.
  const clearing = onboardingDrafts.clear(id);
  await Promise.all([clearing, clearOnboardingPhotoFiles(id)]);
}
