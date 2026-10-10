import { getSupabase, isSupabaseConfigured, isDemoMode } from './supabase';
import { mockVenues } from '../data/mock';
import { DbVenue, Venue, toVenue } from './mappers';

const useMock = () => isDemoMode() || !isSupabaseConfigured;

/** All venues, alphabetical. */
export async function listVenues(): Promise<Venue[]> {
  if (useMock()) return mockVenues;
  const supabase = getSupabase()!;
  const { data, error } = await supabase.from('venues').select('*').order('name');
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
  let req = supabase.from('venues').select('*').order('name').limit(20);
  if (q) req = req.or(`name.ilike.%${q}%,category.ilike.%${q}%,area.ilike.%${q}%`);
  const { data, error } = await req;
  if (error) throw new Error(error.message);
  return ((data ?? []) as DbVenue[]).map(toVenue);
}

/** Venues near a point, via the PostGIS RPC. */
export async function nearbyVenues(lat: number, lng: number, radiusM = 5000): Promise<Venue[]> {
  if (useMock()) return mockVenues;
  const supabase = getSupabase()!;
  const { data, error } = await supabase.rpc('nearby_venues', { lat, lng, radius_m: radiusM });
  if (error) throw new Error(error.message);
  return ((data ?? []) as DbVenue[]).map(toVenue);
}

export async function getVenue(id: string): Promise<Venue | null> {
  if (useMock()) return mockVenues.find((v) => v.id === id) ?? null;
  const supabase = getSupabase()!;
  const { data, error } = await supabase.from('venues').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toVenue(data as DbVenue) : null;
}
