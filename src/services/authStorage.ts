import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { createChunkedAuthStorage } from "./chunkedAuthStorage";

const secure = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) =>
    SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    }),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};
export const authStorage =
  Platform.OS === "web"
    ? AsyncStorage
    : createChunkedAuthStorage(secure, AsyncStorage, Crypto.randomUUID);
