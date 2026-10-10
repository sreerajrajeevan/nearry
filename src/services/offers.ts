import { getSupabase, isSupabaseConfigured, isDemoMode } from './supabase';
import { mockOffers } from '../data/mock';
import { DbOffer, Offer, toOffer } from './mappers';
import { OfferDraft, validateOfferInput } from '../utils/validation';

const useMock = () => isDemoMode() || !isSupabaseConfigured;

export type NewOfferInput = OfferDraft & { venueId?: string };

function toDb(input: NewOfferInput, businessId: string, status: string): Record<string, unknown> {
  return {
    business_id: businessId,
    title: input.title.trim(),
    description: input.description.trim(),
    discount_pct: input.discountPct ?? null,
    price_cents: input.priceCents ?? null,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    venue_id: input.venueId ?? null,
    slot_capacity: input.slotCapacity,
    status,
  };
}

function withBusiness(row: Record<string, unknown>): Offer {
  const b = row.business as { display_name?: string } | null;
  return toOffer({
    ...(row as unknown as DbOffer),
    business: { display_name: b?.display_name ?? 'Business' },
  });
}

/** Public: live offers, soonest-ending first. */
export async function listLiveOffers(): Promise<Offer[]> {
  if (useMock()) return mockOffers.filter((o) => o.status === 'live');
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from('offers')
    .select('*, business:profiles!offers_business_id_fkey(display_name)')
    .eq('status', 'live')
    .gt('ends_at', new Date().toISOString())
    .order('ends_at', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(withBusiness);
}

/** Owner: all my offers, newest first. */
export async function listMyOffers(businessId: string): Promise<Offer[]> {
  if (useMock()) return mockOffers.filter((o) => o.businessId === businessId || o.businessId === 'b1');
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from('offers')
    .select('*, business:profiles!offers_business_id_fkey(display_name)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(withBusiness);
}

export async function getOffer(id: string): Promise<Offer | null> {
  if (useMock()) return mockOffers.find((o) => o.id === id) ?? null;
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from('offers')
    .select('*, business:profiles!offers_business_id_fkey(display_name)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? withBusiness(data as Record<string, unknown>) : null;
}

/** Save as draft. Publishing is a separate, verification-gated step. */
export async function createDraft(businessId: string, input: NewOfferInput): Promise<Offer> {
  const err = validateOfferInput(input);
  if (err) throw new Error(err);
  if (useMock()) {
    const created: Offer = {
      id: `mock-offer-${Date.now()}`,
      businessId,
      businessName: 'Your Business',
      title: input.title.trim(),
      description: input.description.trim(),
      discountPct: input.discountPct,
      priceCents: input.priceCents,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      venueId: input.venueId,
      slotCapacity: input.slotCapacity,
      status: 'draft',
      redemptions: 0,
      createdAt: new Date().toISOString(),
    };
    mockOffers.unshift(created);
    return created;
  }
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from('offers')
    .insert(toDb(input, businessId, 'draft'))
    .select('*, business:profiles!offers_business_id_fkey(display_name)')
    .single();
  if (error) throw new Error(error.message);
  return withBusiness(data as Record<string, unknown>);
}

/**
 * Publish a draft. Server (guard_offer_publish) rejects unless the business
 * is verified — the error surfaces here.
 */
export async function publishOffer(offerId: string): Promise<Offer> {
  if (useMock()) {
    const o = mockOffers.find((x) => x.id === offerId);
    if (!o) throw new Error('Offer not found.');
    o.status = 'live';
    return o;
  }
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from('offers')
    .update({ status: 'live' })
    .eq('id', offerId)
    .select('*, business:profiles!offers_business_id_fkey(display_name)')
    .single();
  if (error) throw new Error(friendlyOfferError(error.message));
  return withBusiness(data as Record<string, unknown>);
}

/** Edit a draft (or a live offer's non-status fields). */
export async function updateOffer(offerId: string, input: Partial<NewOfferInput>): Promise<Offer> {
  const dbPatch: Record<string, unknown> = {};
  if (input.title !== undefined) dbPatch.title = input.title.trim();
  if (input.description !== undefined) dbPatch.description = input.description.trim();
  if (input.discountPct !== undefined) dbPatch.discount_pct = input.discountPct ?? null;
  if (input.priceCents !== undefined) dbPatch.price_cents = input.priceCents ?? null;
  if (input.startsAt !== undefined) dbPatch.starts_at = input.startsAt;
  if (input.endsAt !== undefined) dbPatch.ends_at = input.endsAt;
  if (input.venueId !== undefined) dbPatch.venue_id = input.venueId ?? null;
  if (input.slotCapacity !== undefined) dbPatch.slot_capacity = input.slotCapacity;

  if (useMock()) {
    const o = mockOffers.find((x) => x.id === offerId);
    if (!o) throw new Error('Offer not found.');
    Object.assign(o, {
      title: input.title?.trim() ?? o.title,
      description: input.description?.trim() ?? o.description,
      discountPct: input.discountPct ?? o.discountPct,
      priceCents: input.priceCents ?? o.priceCents,
      startsAt: input.startsAt ?? o.startsAt,
      endsAt: input.endsAt ?? o.endsAt,
      slotCapacity: input.slotCapacity ?? o.slotCapacity,
    });
    return o;
  }
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from('offers')
    .update(dbPatch)
    .eq('id', offerId)
    .select('*, business:profiles!offers_business_id_fkey(display_name)')
    .single();
  if (error) throw new Error(error.message);
  return withBusiness(data as Record<string, unknown>);
}

/** End an offer early. Terminal for customers; business keeps history. */
export async function cancelOffer(offerId: string): Promise<void> {
  if (useMock()) {
    const o = mockOffers.find((x) => x.id === offerId);
    if (o) o.status = 'cancelled';
    return;
  }
  const supabase = getSupabase()!;
  const { error } = await supabase.from('offers').update({ status: 'cancelled' }).eq('id', offerId);
  if (error) throw new Error(error.message);
}

function friendlyOfferError(message: string): string {
  if (message.toLowerCase().includes('verified'))
    return 'Only verified businesses can publish offers. Submit your verification documents first.';
  return message;
}
