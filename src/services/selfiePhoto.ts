import { Platform } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import { base64Bytes } from "../utils/base64Bytes";
import { submitSelfieImage } from "./selfieVerification";
export async function submitPersonalSelfie(
  userId: string,
  uri: string,
): Promise<void> {
  if (Platform.OS === "web")
    throw new Error("Use the Nearry phone app to take your selfie.");
  const normalized = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 960 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  );
  try {
    const text = await FileSystem.readAsStringAsync(normalized.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await submitSelfieImage(userId, base64Bytes(text));
  } finally {
    await FileSystem.deleteAsync(normalized.uri, { idempotent: true }).catch(
      () => {},
    );
  }
}
