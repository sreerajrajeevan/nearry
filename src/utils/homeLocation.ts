import {
  validPlace,
  type Place,
  type PlaceKind,
} from "../../supabase/functions/_shared/placeTypes";

/** Distances people can pick on Home. The last one is also the search limit. */
export const HOME_DISTANCES = [2, 5, 10, 25, 50] as const;
export type HomeDistance = (typeof HOME_DISTANCES)[number];
export const MAX_HOME_DISTANCE: HomeDistance = 50;
export const isHomeDistance = (value: unknown): value is HomeDistance =>
  HOME_DISTANCES.includes(value as HomeDistance);

/** Google keeps place coordinates for at most 30 days; stay under that. */
const KEEP_FOR_MS = 29 * 86400000;
const MAX_RECENTS = 4;

/**
 * City, area or a specific spot. Uses the provider's answer when there is
 * one, otherwise reads it from the address: "Bengaluru, Karnataka, India" is
 * a city, "Koramangala, Bengaluru, Karnataka, India" an area, and anything
 * with a longer address (a street, a café, a mall) a spot.
 */
export function placeKind(
  place: Pick<Place, "name" | "address"> & { kind?: PlaceKind },
): PlaceKind {
  if (place.kind) return place.kind;
  const name = place.name.trim().toLowerCase();
  const parts = place.address
    .split(",")
    .map((part) => part.trim())
    .filter(
      (part) =>
        part && part.toLowerCase() !== name && part.toLowerCase() !== "india",
    );
  if (parts.length <= 1) return "city";
  if (parts.length === 2) return "area";
  return "spot";
}

/** A sensible starting distance for what was searched. */
export function defaultDistance(kind: PlaceKind | "me"): HomeDistance {
  if (kind === "city") return 25;
  if (kind === "spot") return 2;
  return 5;
}

/**
 * Never show an empty Home without trying further out first: keep the chosen
 * distance when it has plans, otherwise use the next distance that does.
 */
export function widenDistance(
  chosen: number,
  countWithin: (km: number) => number,
): { distanceKm: number; widened: boolean } {
  if (countWithin(chosen) > 0) return { distanceKm: chosen, widened: false };
  for (const km of HOME_DISTANCES)
    if (km > chosen && countWithin(km) > 0)
      return { distanceKm: km, widened: true };
  return { distanceKm: chosen, widened: false };
}

export const distanceLabel = (km: number) => `${km} km`;

export type RecentPlace = Place & { kind: PlaceKind; savedAt: string };
export type HomeLocation = {
  current:
    | { type: "place"; place: RecentPlace }
    | { type: "me"; latitude: number; longitude: number; savedAt: string }
    | null;
  distanceKm: HomeDistance | null;
  recents: RecentPlace[];
};
export const EMPTY_HOME_LOCATION: HomeLocation = {
  current: null,
  distanceKm: null,
  recents: [],
};
export const homeLocationKey = (accountId: string) =>
  `nearry.home-location.v1:${accountId}`;

function fresh(savedAt: unknown, now: number) {
  const time = typeof savedAt === "string" ? Date.parse(savedAt) : NaN;
  return Number.isFinite(time) && time <= now && now - time < KEEP_FOR_MS;
}
function recentPlace(value: unknown, now: number): RecentPlace | null {
  const place = value as RecentPlace | null;
  return validPlace(place) &&
    !!place.kind &&
    fresh(place.savedAt, now) &&
    place.name.length <= 200 &&
    place.address.length <= 500
    ? place
    : null;
}

/** Reads the saved Home location, dropping anything invalid or too old. */
export function parseHomeLocation(
  raw: string | null,
  now = Date.now(),
): HomeLocation {
  if (!raw) return EMPTY_HOME_LOCATION;
  let data: Partial<HomeLocation> & { current?: any };
  try {
    data = JSON.parse(raw);
  } catch {
    return EMPTY_HOME_LOCATION;
  }
  if (!data || typeof data !== "object") return EMPTY_HOME_LOCATION;
  const recents = (Array.isArray(data.recents) ? data.recents : [])
    .map((item) => recentPlace(item, now))
    .filter((item): item is RecentPlace => !!item)
    .slice(0, MAX_RECENTS);
  let current: HomeLocation["current"] = null;
  const saved = data.current;
  if (saved?.type === "place") {
    const place = recentPlace(saved.place, now);
    if (place) current = { type: "place", place };
  } else if (
    saved?.type === "me" &&
    Number.isFinite(saved.latitude) &&
    Number.isFinite(saved.longitude) &&
    Math.abs(saved.latitude) <= 90 &&
    Math.abs(saved.longitude) <= 180 &&
    fresh(saved.savedAt, now)
  )
    current = {
      type: "me",
      latitude: saved.latitude,
      longitude: saved.longitude,
      savedAt: saved.savedAt,
    };
  return {
    current,
    distanceKm:
      current && isHomeDistance(data.distanceKm) ? data.distanceKm : null,
    recents,
  };
}

/** Newest first, no repeats, a short list. */
export function rememberPlace(
  recents: readonly RecentPlace[],
  place: Place,
  now = new Date(),
): RecentPlace[] {
  const entry: RecentPlace = {
    ...place,
    kind: placeKind(place),
    savedAt: now.toISOString(),
  };
  return [
    entry,
    ...recents.filter(
      (item) => !(item.provider === place.provider && item.id === place.id),
    ),
  ].slice(0, MAX_RECENTS);
}
