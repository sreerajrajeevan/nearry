import { type Cursor, type Page } from "../utils/pagination";
import { assertLive } from "./demoGuard";
import { getSupabase, isSupabaseConfigured, isDemoMode } from "./supabase";
import { mockVenues } from "../data/mock";
import { searchLiteral } from "../utils/searchFilter";
import { DbVenue, Venue, toVenue } from "./mappers";

const useMock = () => {
  if (isDemoMode()) return true;
  if (!isSupabaseConfigured)
    throw new Error("Backend not configured. Choose demo mode to preview.");
  return false;
};

/** All venues, alphabetical. */
export async function listVenues(): Promise<Venue[]> {
  if (useMock()) return mockVenues;
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .order("name")
    .limit(80);
  if (error) throw new Error(error.message);
  return ((data ?? []) as DbVenue[]).map(toVenue);
}

/** Case-insensitive name/category/area search. */
export async function searchVenues(query: string): Promise<Venue[]> {
  const q = query.trim();
  if (useMock()) {
    const needle = q.toLowerCase();
    if (!needle) return mockVenues;
    return mockVenues.filter(
      (v) =>
        v.name.toLowerCase().includes(needle) ||
        v.category.toLowerCase().includes(needle) ||
        v.area.toLowerCase().includes(needle),
    );
  }
  const supabase = getSupabase()!;
  let req = supabase.from("venues").select("*").order("name").limit(20);
  if (q) {
    const literal = searchLiteral(q);
    req = req.or(
      `name.imatch.${literal},category.imatch.${literal},area.imatch.${literal}`,
    );
  }
  const { data, error } = await req;
  if (error) throw new Error(error.message);
  return ((data ?? []) as DbVenue[]).map(toVenue);
}

export async function searchVenuesPage(
  query: string,
  cursor: Cursor | null = null,
): Promise<Page<Venue>> {
  const q = query.trim().slice(0, 120);
  if (useMock()) {
    const all = await searchVenues(q);
    const start = cursor ? all.findIndex((v) => v.id === cursor.id) + 1 : 0,
      rows = all.slice(start, start + 20),
      last = rows.at(-1);
    return {
      items: rows,
      cursor:
        start + rows.length < all.length && last
          ? { at: last.name, id: last.id }
          : null,
    };
  }
  let req = getSupabase()!
    .from("venues")
    .select("*")
    .order("name")
    .order("id")
    .limit(21);
  if (q) {
    const literal = searchLiteral(q);
    req = req.or(
      `name.imatch.${literal},category.imatch.${literal},area.imatch.${literal}`,
    );
  }
  if (cursor) {
    if (!/^[0-9a-f-]{36}$/i.test(cursor.id))
      throw new Error("Please refresh this search.");
    const name = JSON.stringify(cursor.at);
    req = req.or(`name.gt.${name},and(name.eq.${name},id.gt.${cursor.id})`);
  }
  const { data, error } = await req;
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) throw new Error("Could not load places.");
  const rows = data.slice(0, 20).map((r) => toVenue(r as DbVenue)),
    last = rows.at(-1);
  return {
    items: rows,
    cursor: data.length > 20 && last ? { at: last.name, id: last.id } : null,
  };
}

/** Venues near a point, via the PostGIS RPC. */
export async function nearbyVenues(
  lat: number,
  lng: number,
  radiusM = 5000,
): Promise<Venue[]> {
  if (useMock()) return mockVenues;
  const supabase = getSupabase()!;
  const { data, error } = await supabase.rpc("nearby_venues_with_distance", {
    p_lat: lat,
    p_lng: lng,
    p_radius_m: radiusM,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as (DbVenue & { distance_m: number })[]).map((row) => ({
    ...toVenue(row),
    distanceKm: row.distance_m / 1000,
  }));
}

export async function getVenue(id: string): Promise<Venue | null> {
  if (useMock()) return mockVenues.find((v) => v.id === id) ?? null;
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toVenue(data as DbVenue) : null;
}

/** Update a venue's amenities (business owner only, enforced by RLS). */
export async function updateVenueAmenities(
  venueId: string,
  amenities: string[],
): Promise<void> {
  assertLive("edit your venue");
  if (useMock()) {
    const v = mockVenues.find((x) => x.id === venueId);
    if (v) v.amenities = amenities;
    return;
  }
  const supabase = getSupabase()!;
  const { error } = await supabase
    .from("venues")
    .update({ amenities })
    .eq("id", venueId);
  if (error) throw new Error(error.message);
}
