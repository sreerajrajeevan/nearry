import * as Location from "expo-location";

/**
 * Location service — milestone 2.
 * Wraps expo-location; currently exposes permission + last-known position.
 * Venue proximity queries will live in venues.ts.
 */
export type LatLng = { latitude: number; longitude: number };

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted";
}

export async function getCurrentPosition(): Promise<LatLng | null> {
  try {
    const granted = await requestLocationPermission();
    if (!granted) return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return null;
  }
}

export { distanceKm } from "./locationDistance";
