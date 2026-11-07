import * as Location from 'expo-location';

/**
 * Location service — milestone 2.
 * Wraps expo-location; currently exposes permission + last-known position.
 * Venue proximity queries will live in venues.ts.
 */
export type LatLng = { latitude: number; longitude: number };

/** How long to wait for a fresh GPS fix before falling back to last-known. */
const FIX_TIMEOUT_MS = 10000;

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Location timed out')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

export async function getCurrentPosition(): Promise<LatLng | null> {
  try {
    const granted = await requestLocationPermission();
    if (!granted) return null;
    try {
      const pos = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        FIX_TIMEOUT_MS,
      );
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch {
      // A fresh fix can hang or fail (indoors, first fix after install).
      // Fall back to the last-known position instead of giving up entirely.
      const last = await Location.getLastKnownPositionAsync();
      if (last) return { latitude: last.coords.latitude, longitude: last.coords.longitude };
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Human-readable area for a point, e.g. "Indiranagar, Bengaluru".
 * Returns null when the geocoder has nothing useful — callers must cope.
 */
export async function reverseGeocodeArea(point: LatLng): Promise<string | null> {
  try {
    const [place] = await Location.reverseGeocodeAsync(point);
    if (!place) return null;
    const locality = place.district || place.subregion || place.name || null;
    const city = place.city || place.region || null;
    const parts = [locality, city].filter((p): p is string => !!p);
    // Avoid "Bengaluru, Bengaluru" when district and city agree.
    const unique = [...new Set(parts)];
    return unique.length > 0 ? unique.join(', ') : null;
  } catch {
    return null;
  }
}

/** Short display string for raw coordinates, e.g. "12.9716, 77.5946". */
export function formatLatLng(point: LatLng): string {
  return `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`;
}

/** Haversine distance in km — used by mock sorting until PostGIS is wired. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const la1 = (a.latitude * Math.PI) / 180;
  const la2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
