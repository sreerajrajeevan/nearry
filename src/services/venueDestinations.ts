import { getSupabase, isDemoMode } from "./supabase";
import { mockVenues } from "../data/mock";
import { validCoordinates, type Coordinates } from "../utils/cardDistance";

export type VenueDestination = {
  name: string;
  point?: Coordinates;
  sampleKm?: number;
};
/** Public, RLS-protected venue points, in bounded batches rather than one query per card. */
export async function venueDestinations(
  ids: readonly string[],
): Promise<Map<string, VenueDestination>> {
  const unique = [...new Set(ids)].filter(Boolean),
    result = new Map<string, VenueDestination>();
  if (isDemoMode()) {
    for (const venue of mockVenues)
      if (unique.includes(venue.id))
        result.set(venue.id, { name: venue.name, sampleKm: venue.distanceKm });
    return result;
  }
  const db = getSupabase();
  if (!db || !unique.length) return result;
  for (let start = 0; start < unique.length; start += 100) {
    const { data, error } = await db
      .from("venues")
      .select("id,name,location_lat,location_lng")
      .in("id", unique.slice(start, start + 100));
    if (error) throw new Error(error.message);
    if (!Array.isArray(data))
      throw new Error("Could not load venue locations.");
    for (const row of data) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const point = { latitude: row.location_lat, longitude: row.location_lng };
      if (typeof row.id === "string" && typeof row.name === "string")
        result.set(row.id, {
          name: row.name,
          ...(validCoordinates(point) ? { point } : {}),
        });
    }
  }
  return result;
}
