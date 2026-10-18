import { getSupabase, isSupabaseConfigured, isDemoMode } from "./supabase";
import { multiplexSubscribe } from "./realtime";
import { mockBookings, mockOffers } from "../data/mock";
import { Booking, DbBooking, toBooking } from "./mappers";

const useMock = () => {
  if (isDemoMode()) return true;
  if (!isSupabaseConfigured)
    throw new Error("Backend not configured. Choose demo mode to preview.");
  return false;
};

function fromView(row: Record<string, unknown>): Booking {
  return toBooking({
    ...(row as unknown as DbBooking),
    customer: { display_name: (row.customer_name as string) ?? "Someone" },
    offer: { title: (row.offer_title as string) ?? "Offer" },
  });
}

/**
 * Book seats in the selected business-defined slot. book_offer_slot() locks the offer row,
 * so concurrent bookings for the same slot serialize — no overbooking.
 */
export async function bookOffer(
  offerId: string,
  slotId: string,
  partySize: number,
): Promise<{ bookingId: string; seatsLeft: number }> {
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 50)
    throw new Error("Party size must be between 1 and 50.");
  if (useMock()) {
    const offer = mockOffers.find((o) => o.id === offerId);
    const slot = (await listOfferSlots(offerId)).find((s) => s.id === slotId);
    if (!offer || !slot || slot.seats_left < partySize)
      throw new Error("Choose an available slot with enough places.");
    const b: Booking = {
      id: `mock-bk-${Date.now()}`,
      offerId,
      customerId: "demo-user",
      customerName: "You",
      offerTitle: offer.title,
      businessId: offer.businessId,
      slot: slot.starts_at,
      partySize,
      status: "pending",
      holdExpiresAt: new Date(
        Math.min(Date.now() + 30 * 60_000, new Date(slot.starts_at).getTime()),
      ).toISOString(),
      createdAt: new Date().toISOString(),
    };
    mockBookings.unshift(b);
    return { bookingId: b.id, seatsLeft: slot.seats_left - partySize };
  }
  const supabase = getSupabase()!;
  const { data, error } = await supabase.rpc("book_offer_slot", {
    p_slot_id: slotId,
    p_party_size: partySize,
  });
  if (error) throw new Error(friendlyBookingError(error.message));
  const res = data as { booking_id: string; seats_left: number };
  return { bookingId: res.booking_id, seatsLeft: res.seats_left };
}

/** My bookings as a customer, newest first. */
export async function listMyBookings(customerId: string): Promise<Booking[]> {
  if (useMock())
    return mockBookings.filter(
      (b) => b.customerId === customerId || b.customerId === "demo-user",
    );
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from("bookings")
    .select("*, offer:offers!bookings_offer_id_fkey(title, business_id)")
    .eq("customer_id", customerId)
    .order("slot", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const offerRow = row.offer as {
      title?: string;
      business_id?: string;
    } | null;
    return toBooking({
      ...(row as unknown as DbBooking),
      business_id: offerRow?.business_id,
      offer: { title: offerRow?.title ?? "Offer" },
      customer: { display_name: "You" },
    });
  });
}

/** Bookings across all my offers (business view), via the business_bookings view. */
export async function listBookingsForBusiness(
  businessId: string,
): Promise<Booking[]> {
  if (useMock()) return mockBookings;
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from("business_bookings")
    .select("*")
    .eq("business_id", businessId)
    .order("slot", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(fromView);
}

/** Business confirms a pending booking. */
export async function confirmBooking(bookingId: string): Promise<void> {
  if (useMock()) {
    const b = mockBookings.find((x) => x.id === bookingId);
    if (
      !b ||
      b.status !== "pending" ||
      new Date(b.slot).getTime() <= Date.now() ||
      (b.holdExpiresAt && new Date(b.holdExpiresAt).getTime() <= Date.now())
    )
      throw new Error("Booking cannot be confirmed.");
    b.status = "confirmed";
    return;
  }
  const supabase = getSupabase()!;
  const { error } = await supabase.rpc("change_booking_status", {
    p_booking_id: bookingId,
    p_status: "confirmed",
  });
  if (error) throw new Error(error.message);
}

/**
 * Cancel a booking (customer or business). Capacity is sum-derived, so seats
 * free up automatically.
 */
export async function cancelBooking(bookingId: string): Promise<void> {
  if (useMock()) {
    const b = mockBookings.find((x) => x.id === bookingId);
    if (b) b.status = "cancelled";
    return;
  }
  const supabase = getSupabase()!;
  const { error } = await supabase.rpc("change_booking_status", {
    p_booking_id: bookingId,
    p_status: "cancelled",
  });
  if (error) throw new Error(error.message);
}

/** Realtime subscription for booking changes. No-op in demo mode. */
export function subscribeToBookings(onChange: () => void): () => void {
  if (useMock()) return () => {};
  // Multiplexed: Activity, Dashboard and Bookings screens share this topic.
  return multiplexSubscribe(
    "bookings-feed",
    (ch, fire) =>
      ch
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "bookings" },
          () => fire(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "offers" },
          () => fire(),
        ),
    onChange,
  );
}

function friendlyBookingError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("not live")) return "This offer is no longer live.";
  if (m.includes("own offer")) return "You can't book your own offer.";
  if (m.includes("outside the offer window"))
    return "Pick a slot within the offer dates.";
  if (m.includes("future")) return "Pick a future slot.";
  if (m.includes("seats left")) return "Not enough seats left for that slot.";
  return message;
}

export type AvailableSlot = {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  seats_left: number;
};
export async function listOfferSlots(
  offerId: string,
): Promise<AvailableSlot[]> {
  if (useMock()) {
    const offer = mockOffers.find((o) => o.id === offerId);
    if (!offer || offer.status !== "live") return [];
    const duration = (offer.slotMinutes ?? 60) * 60_000;
    const start = new Date(offer.startsAt).getTime();
    const end = new Date(offer.endsAt).getTime();
    const first = Math.max(0, Math.ceil((Date.now() - start) / duration));
    const slots: AvailableSlot[] = [];
    for (let i = first; i < first + 3; i++) {
      const time = start + i * duration;
      if (time + duration > end) break;
      const starts_at = new Date(time).toISOString();
      const occupied = mockBookings
        .filter(
          (b) =>
            b.offerId === offerId &&
            b.slot === starts_at &&
            b.status !== "cancelled" &&
            (b.status === "confirmed" ||
              !b.holdExpiresAt ||
              new Date(b.holdExpiresAt).getTime() > Date.now()),
        )
        .reduce((sum, b) => sum + b.partySize, 0);
      slots.push({
        id: `demo-slot:${offerId}:${time}`,
        starts_at,
        ends_at: new Date(time + duration).toISOString(),
        capacity: offer.slotCapacity,
        seats_left: Math.max(0, offer.slotCapacity - occupied),
      });
    }
    return slots;
  }
  const { data, error } = await getSupabase()!.rpc("available_offer_slots", {
    p_offer_id: offerId,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}
