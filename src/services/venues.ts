import { getSupabase, isSupabaseConfigured } from './supabase';
import { mockVenues, Venue } from '../data/mock';

/**
 * Venue service — milestone 2.
 * Later: PostGIS `nearby_venues(lat, lng, radius_m)` RPC + venue detail pages.
 */
export async function searchVenues(query: string): Promise<Venue[]> {
  if (isSupabaseConfigured) {
    const supabase = getSupabase()!;
    const { data, error } = await supabase
      .from('venues')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(20);
    if (error) throw new Error(error.message);
    return (data ?? []) as Venue[];
  }
  const q = query.trim().toLowerCase();
  if (!q) return mockVenues;
  return mockVenues.filter(
    (v) =>
      v.name.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q) ||
      v.area.toLowerCase().includes(q),
  );
}

export async function getVenue(id: string): Promise<Venue | undefined> {
  if (isSupabaseConfigured) {
    const supabase = getSupabase()!;
    const { data, error } = await supabase.from('venues').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    return data as Venue;
  }
  return mockVenues.find((v) => v.id === id);
}
