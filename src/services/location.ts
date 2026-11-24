import * as Location from "expo-location";
import { withDeadline } from "../utils/deadline";

/**
 * Location service — milestone 2.
 * Wraps expo-location; currently exposes permission + last-known position.
 * Venue proximity queries will live in venues.ts.
 */
export type LatLng = { latitude: number; longitude: number };

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await withDeadline(
    Location.requestForegroundPermissionsAsync(),
    30_000,
    "Please enable location in your phone settings and try again.",
  );
  return status === "granted";
}

export async function getCurrentPosition(): Promise<LatLng | null> {
  try {
    const granted = await requestLocationPermission();
    if (!granted) return null;
    const pos = await withDeadline(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      10_000,
      "Location is taking too long. Choose an area instead.",
    );
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return null;
  }
}

/** Refreshes the position only when permission was already given: never prompts. */
export async function getPositionIfAllowed(): Promise<LatLng | null> {
  try {
    const { status } = await withDeadline(
      Location.getForegroundPermissionsAsync(),
      3_000,
    );
    if (status !== "granted") return null;
    const pos = await withDeadline(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      10_000,
    );
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return null;
  }
}

export { distanceKm } from "./locationDistance";
