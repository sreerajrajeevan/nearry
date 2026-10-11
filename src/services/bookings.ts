import { getSupabase, isSupabaseConfigured, isDemoMode } from './supabase';
import { mockBookings } from '../data/mock';
import { Booking, DbBooking, toBooking } from './mappers';

const useMock = () => isDemoMode() || !isSupabaseConfigured;

function fromView(row: Record<string, unknown>): Booking {
  return toBooking({
    ...(row as unknown as DbBooking),
    customer: { display_name: (row.customer_name as string) ?? 'Someone' },
    offer: { title: (row.offer_title as string) ?? 'Offer' },
  });
}

/**
 * Book seats on a live offer. Atomic: create_booking() locks the offer row,
 * so concurrent bookings for the same slot serialize — no overbooking.
 */
export async function bookOffer(
  offerId: string,
  slotIso: string,
  partySize: number,
): Promise<{ bookingId: string; seatsLeft: number }> {
  if (!Number.isInteger(partySize) || partySize < 1) throw new Error('Party size must be at least 1.');
  if (useMock()) {
    const b: Booking = {
      id: `mock-bk-${Date.now()}`,
      offerId,
      customerId: 'demo-user',
      customerName: 'You',
      offerTitle: 'Demo offer',
      slot: slotIso,
      partySize,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    mockBookings.unshift(b);
    return { bookingId: b.id, seatsLeft: 0 };
  }
  const supabase = getSupabase()!;
  const { data, error } = await supabase.rpc('create_booking', {
    p_offer_id: offerId,
    p_slot: slotIso,
    p_party_size: partySize,
  });
  if (error) throw new Error(friendlyBookingError(error.message));
  const res = data as { booking_id: string; seats_left: number };
  const { data: offerRow } = await supabase
    .from('offers')
    .select('business_id')
    .eq('id', offerId)
    .maybeSingle();
  if (offerRow) {
    const { pushToUser } = await import('./notifications');
    void pushToUser(
      (offerRow as { business_id: string }).business_id,
      'New booking',
      `${partySize} seat(s) booked`,
    ).catch(() => {});
  }
  return { bookingId: res.booking_id, seatsLeft: res.seats_left };
}

/** My bookings as a customer, newest first. */
export async function listMyBookings(customerId: string): Promise<Booking[]> {
  if (useMock()) return mockBookings.filter((b) => b.customerId === customerId || b.customerId === 'demo-user');
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from('bookings')
    .select('*, offer:offers!bookings_offer_id_fkey(title, business_id)')
    .eq('customer_id', customerId)
    .order('slot', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const offerRow = row.offer as { title?: string; business_id?: string } | null;
    return toBooking({
      ...(row as unknown as DbBooking),
      business_id: offerRow?.business_id,
      offer: { title: offerRow?.title ?? 'Offer' },
      customer: { display_name: 'You' },
    });
  });
}

/** Bookings across all my offers (business view), via the business_bookings view. */
export async function listBookingsForBusiness(businessId: string): Promise<Booking[]> {
  if (useMock()) return mockBookings;
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from('business_bookings')
    .select('*')
    .eq('business_id', businessId)
    .order('slot', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(fromView);
}

/** Business confirms a pending booking. */
export async function confirmBooking(bookingId: string): Promise<void> {
  if (useMock()) {
    const b = mockBookings.find((x) => x.id === bookingId);
    if (b) b.status = 'confirmed';
    return;
  }
  const supabase = getSupabase()!;
  const { data: bkRow } = await supabase
    .from('bookings')
    .select('customer_id')
    .eq('id', bookingId)
    .maybeSingle();
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', bookingId);
  if (error) throw new Error(error.message);
  if (bkRow) {
    const { pushToUser } = await import('./notifications');
    void pushToUser(
      (bkRow as { customer_id: string }).customer_id,
      'Booking confirmed',
      'Your booking was confirmed — see you there',
    ).catch(() => {});
  }
}

/**
 * Cancel a booking (customer or business). Capacity is sum-derived, so seats
 * free up automatically.
 */
export async function cancelBooking(bookingId: string): Promise<void> {
  if (useMock()) {
    const b = mockBookings.find((x) => x.id === bookingId);
    if (b) b.status = 'cancelled';
    return;
  }
  const supabase = getSupabase()!;
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId);
  if (error) throw new Error(error.message);
}

/** Realtime subscription for booking changes. No-op in demo mode. */
export function subscribeToBookings(onChange: () => void): () => void {
  if (useMock()) return () => {};
  const supabase = getSupabase()!;
  const ch = supabase
    .channel('bookings-feed')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(ch);
  };
}

function friendlyBookingError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('not live')) return 'This offer is no longer live.';
  if (m.includes('own offer')) return "You can't book your own offer.";
  if (m.includes('outside the offer window')) return 'Pick a slot within the offer dates.';
  if (m.includes('future')) return 'Pick a future slot.';
  if (m.includes('seats left')) return 'Not enough seats left for that slot.';
  return message;
}
