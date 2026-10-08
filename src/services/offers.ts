import { getSupabase, isSupabaseConfigured } from './supabase';
import { mockOffers, Offer } from '../data/mock';

/**
 * Business offers service — milestone 2.
 * Covers last-minute offers (expiring deals pushed to nearby users).
 */
export type NewOffer = {
  title: string;
  description: string;
  discountPct?: number;
  startsAt: string;
  endsAt: string;
  maxRedemptions?: number;
};

export async function listOffers(): Promise<Offer[]> {
  if (isSupabaseConfigured) {
    const supabase = getSupabase()!;
    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .eq('status', 'live')
      .order('ends_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Offer[];
  }
  return mockOffers;
}

export async function createOffer(businessId: string, offer: NewOffer): Promise<Offer> {
  if (isSupabaseConfigured) {
    const supabase = getSupabase()!;
    const { data, error } = await supabase
      .from('offers')
      .insert({ business_id: businessId, status: 'live', ...offer })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Offer;
  }
  const created: Offer = {
    id: `mock-offer-${Date.now()}`,
    businessId,
    businessName: 'Your Business',
    status: 'live',
    redemptions: 0,
    ...offer,
  };
  mockOffers.unshift(created);
  return created;
}
