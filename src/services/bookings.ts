import { assertLive } from "./demoGuard";
import { getSupabase, isSupabaseConfigured, isDemoMode } from "./supabase";
import { multiplexSubscribe } from "./realtime";
import { mockBookings, mockOffers } from "../data/mock";
import { Booking, DbBooking, toBooking } from "./mappers";
import { Cursor, Page } from "../utils/pagination";

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

/** Most people one booking can cover (also enforced by the database). */
export const MAX_PARTY_SIZE = 2;
/** Waiting (unconfirmed) requests one person may hold at a time. */
export const MAX_WAITING_REQUESTS = 3;

/** True while a booking still holds a place: confirmed, or pending and unexpired. */
const holdsPlace = (b: Booking, now = Date.now()) =>
  new Date(b.slot).getTime() > now &&
  (b.status === "confirmed" ||
    (b.status === "pending" &&
      (!b.holdExpiresAt || new Date(b.holdExpiresAt).getTime() > now)));
const sameLocalDay = (a: string, b: string) =>
  new Date(a).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) ===
  new Date(b).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export type BookingFilter =
  "UPCOMING" | "ALL" | "PENDING" | "CONFIRMED" | "CANCELLED" | "EXPIRED";
export async function listBusinessBookingsPage(
  businessId: string,
  filter: BookingFilter = "UPCOMING",
  cursor: Cursor | null = null,
): Promise<Page<Booking>> {
  const now = new Date().toISOString(),
    descending = filter !== "UPCOMING" && filter !== "PENDING";
  if (useMock()) {
    const all = mockBookings
      .filter((b) =>
        filter === "ALL" || filter === "UPCOMING"
          ? filter === "ALL" || holdsPlace(b)
          : filter === "EXPIRED"
            ? b.status === "pending" && !holdsPlace(b)
            : b.status === filter.toLowerCase() &&
              (filter !== "PENDING" || holdsPlace(b)),
      )
      .sort(
        (a, b) =>
          (a.slot.localeCompare(b.slot) || a.id.localeCompare(b.id)) *
          (descending ? -1 : 1),
      );
    const start = cursor ? all.findIndex((b) => b.id === cursor.id) + 1 : 0,
      items = all.slice(start, start + 30),
      last = items.at(-1);
    return {
      items,
      cursor:
        start + items.length < all.length && last
          ? { at: last.slot, id: last.id }
          : null,
    };
  }
  let req = getSupabase()!
    .from("business_bookings")
    .select("*")
    .eq("business_id", businessId)
    .order("slot", { ascending: !descending })
    .order("id", { ascending: !descending })
    .limit(31);
  if (filter === "UPCOMING" || filter === "PENDING")
    req = req
      .gt("slot", now)
      .or(
        `status.eq.confirmed,and(status.eq.pending,or(hold_expires_at.is.null,hold_expires_at.gt.${now}))`,
      );
  if (filter === "PENDING") req = req.eq("status", "pending");
  else if (filter === "EXPIRED")
    req = req.or(
      `and(status.eq.pending,or(slot.lte.${now},hold_expires_at.lte.${now}))`,
    );
  else if (filter !== "UPCOMING" && filter !== "ALL")
    req = req.eq("status", filter.toLowerCase());
  if (cursor) {
    if (
      !/^[0-9a-f-]{36}$/i.test(cursor.id) ||
      !Number.isFinite(Date.parse(cursor.at))
    )
      throw new Error("Please refresh bookings.");
    const op = descending ? "lt" : "gt";
    req = req.or(
      `slot.${op}.${cursor.at},and(slot.eq.${cursor.at},id.${op}.${cursor.id})`,
    );
  }
  const { data, error } = await req;
  if (error) throw new Error(error.message);
  const items = (data ?? []).slice(0, 30).map(fromView),
    last = items.at(-1);
  return {
    items,
    cursor:
      (data?.length ?? 0) > 30 && last ? { at: last.slot, id: last.id } : null,
  };
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
  assertLive("book offers");
  if (
    !Number.isInteger(partySize) ||
    partySize < 1 ||
    partySize > MAX_PARTY_SIZE
  )
    throw new Error(`A booking can be for 1 or ${MAX_PARTY_SIZE} people.`);
  if (useMock()) {
    const offer = mockOffers.find((o) => o.id === offerId);
    const slot = (await listOfferSlots(offerId)).find((s) => s.id === slotId);
    if (!offer || !slot)
      throw new Error("Choose an available slot with enough places.");
    // Same fair-use rules as the database.
    const mine = mockBookings.filter(
      (b) => b.customerId === "demo-user" && holdsPlace(b),
    );
    const retry = mine.find(
      (b) => b.offerId === offerId && b.slot === slot.starts_at,
    );
    if (retry) {
      if (retry.partySize !== partySize)
        throw new Error(
          "You already requested this slot. Manage the existing booking in Activity.",
        );
      return { bookingId: retry.id, seatsLeft: slot.seats_left };
    }
    if (slot.seats_left < partySize)
      throw new Error("Choose an available slot with enough places.");
    if (
      mine.some(
        (b) => b.offerId === offerId && sameLocalDay(b.slot, slot.starts_at),
      )
    )
      throw new Error(
        "You already have one booking for this offer on that day. Cancel it in Activity to pick another time.",
      );
    if (
      mine.filter((b) => b.status === "pending").length >= MAX_WAITING_REQUESTS
    )
      throw new Error(
        `You can have up to ${MAX_WAITING_REQUESTS} requests waiting for a business to confirm. Try again once one is confirmed or cancelled.`,
      );
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
    .gte("slot", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
    .order("slot", { ascending: true })
    .limit(80);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(fromView);
}

/** Business confirms a pending booking. */
export async function confirmBooking(bookingId: string): Promise<void> {
  assertLive("confirm bookings");
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
  assertLive("cancel bookings");
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
  if (m.includes("offer window")) return "Pick a slot within the offer dates.";
  if (m.includes("future")) return "Pick a future slot.";
  if (m.includes("seats left")) return "Not enough seats left for that slot.";
  if (m.includes("resource already booked"))
    return "That time was just taken. Please pick another slot.";
  if (m.includes("not verified"))
    return "This business can't take bookings right now.";
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

export async function listMyBookingsPage(
  customerId: string,
  history = false,
  cursor: Cursor | null = null,
): Promise<Page<Booking>> {
  const now = new Date().toISOString();
  if (useMock()) {
    const all = (await listMyBookings(customerId))
      .filter((b) => !holdsPlace(b) === history)
      .sort((a, b) => b.slot.localeCompare(a.slot) || b.id.localeCompare(a.id));
    const start = cursor ? all.findIndex((b) => b.id === cursor.id) + 1 : 0,
      items = all.slice(start, start + 30),
      last = items.at(-1);
    return {
      items,
      cursor:
        start + items.length < all.length && last
          ? { at: last.slot, id: last.id }
          : null,
    };
  }
  let req = getSupabase()!
    .from("bookings")
    .select("*,offer:offers!bookings_offer_id_fkey(title,business_id)")
    .eq("customer_id", customerId)
    .order("slot", { ascending: !history })
    .order("id", { ascending: !history })
    .limit(31);
  req = history
    ? req.or(
        "status.eq.cancelled,slot.lte." +
          now +
          ",and(status.eq.pending,hold_expires_at.lte." +
          now +
          ")",
      )
    : req
        .gt("slot", now)
        .or(
          "status.eq.confirmed,and(status.eq.pending,or(hold_expires_at.is.null,hold_expires_at.gt." +
            now +
            "))",
        );
  if (cursor) {
    if (
      !/^[0-9a-f-]{36}$/i.test(cursor.id) ||
      !Number.isFinite(Date.parse(cursor.at))
    )
      throw new Error("Please refresh bookings.");
    const op = history ? "lt" : "gt";
    req = req.or(
      "slot." +
        op +
        "." +
        cursor.at +
        ",and(slot.eq." +
        cursor.at +
        ",id." +
        op +
        "." +
        cursor.id +
        ")",
    );
  }
  const { data, error } = await req;
  if (error) throw new Error(error.message);
  const items = (data ?? []).slice(0, 30).map((row) =>
      toBooking({
        ...(row as unknown as DbBooking),
        business_id: row.offer?.business_id,
        offer: { title: row.offer?.title ?? "Offer" },
        customer: { display_name: "You" },
      }),
    ),
    last = items.at(-1);
  return {
    items,
    cursor:
      (data?.length ?? 0) > 30 && last ? { at: last.slot, id: last.id } : null,
  };
}
export async function businessDaySummary() {
  const now = new Date(),
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    until = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (useMock()) {
    const { businessDay } = await import("../utils/businessDay");
    const day = businessDay(mockBookings, mockOffers, now);
    return {
      today: day.today.length,
      waiting: day.today.filter((b) => b.status === "pending" && holdsPlace(b))
        .length,
      liveOffers: day.liveOffers.length,
      drafts: day.drafts.length,
    };
  }
  const { data, error } = await getSupabase()!.rpc("business_day_summary", {
    p_from: from.toISOString(),
    p_until: until.toISOString(),
  });
  if (error) throw new Error("Could not load today's totals.");
  return data as {
    today: number;
    waiting: number;
    liveOffers: number;
    drafts: number;
  };
}
