import {
  parsePage,
  pageSize,
  type Page,
  type Cursor,
} from "../utils/pagination";
import {
  discoverOffers,
  offerDiscoveryCategory,
  type OfferCategory,
} from "../utils/offerDiscovery";
import type { DiscoveryCategory } from "../utils/discovery";
import { assertLive } from "./demoGuard";
import { demoUserBlocked } from "./safety";
import { getSupabase, isSupabaseConfigured, isDemoMode } from "./supabase";
import { LIVE_FEED_CALM, multiplexSubscribe } from "./realtime";
import { mockBookings, mockOffers } from "../data/mock";
import { DbOffer, Offer, toOffer } from "./mappers";
import { OfferDraft, validateOfferInput } from "../utils/validation";

const useMock = () => {
  if (isDemoMode()) return true;
  if (!isSupabaseConfigured)
    throw new Error("Backend not configured. Choose demo mode to preview.");
  return false;
};

export type NewOfferInput = OfferDraft & { venueId?: string };

function toDb(
  input: NewOfferInput,
  businessId: string,
  status: string,
): Record<string, unknown> {
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
    slot_minutes: input.slotMinutes ?? 60,
    resource_key: input.resourceKey ?? "default",
    cover_photo_url: input.coverPhotoUrl ?? null,
    is_spotlight: input.isSpotlight ?? false,
    status,
  };
}

function withBusiness(row: Record<string, unknown>): Offer {
  const b = row.business as {
    display_name?: string;
    business_name?: string;
  } | null;
  return toOffer({
    ...(row as unknown as DbOffer),
    business: {
      display_name:
        b?.business_name ||
        b?.display_name ||
        (row.discovery_business_name as string) ||
        (row.discovery_display_name as string) ||
        "Business",
    },
  });
}

/** Public: live offers, soonest-ending first. */
export async function listLiveOffers(venueIds?: string[]): Promise<Offer[]> {
  if (useMock())
    return mockOffers.filter(
      (o) =>
        o.status === "live" &&
        !demoUserBlocked(o.businessId) &&
        (!venueIds || venueIds.includes(o.venueId ?? "")),
    );
  if (venueIds && !venueIds.length) return [];
  const supabase = getSupabase()!;
  let query = supabase
    .from("discovery_offers")
    .select("*")
    .eq("status", "live")
    .gt("ends_at", new Date().toISOString())
    .order("ends_at")
    .order("id")
    .limit(80);
  if (venueIds) query = query.in("venue_id", venueIds);
  const { data, error } = await query;
  if (error) throw new Error(friendlyOfferError(error.message));
  return ((data ?? []) as Record<string, unknown>[]).map(withBusiness);
}

export type OfferPageFilter = {
  venueIds?: string[];
  search?: string;
  category?: OfferCategory;
  discoveryCategory?: DiscoveryCategory | null;
  spotlight?: boolean;
  nearby?: { latitude: number; longitude: number; radiusM: number };
};
export async function listOffersPage(
  filter: OfferPageFilter = {},
  cursor: Cursor | null = null,
  limit = 30,
): Promise<Page<Offer>> {
  if (filter.venueIds?.length === 0) return { items: [], cursor: null };
  if (useMock()) {
    let items = discoverOffers(
      await listLiveOffers(filter.venueIds),
      filter.category ?? "all",
    );
    if (filter.search)
      items = items.filter((o) =>
        (o.title + " " + o.businessName + " " + o.description)
          .toLowerCase()
          .includes(filter.search!.toLowerCase()),
      );
    if (filter.spotlight) items = items.filter((o) => o.isSpotlight);
    if (filter.discoveryCategory)
      items = items.filter(
        (o) => offerDiscoveryCategory(o) === filter.discoveryCategory,
      );
    items.sort(
      (a, b) =>
        Number(b.isSpotlight) - Number(a.isSpotlight) ||
        a.endsAt.localeCompare(b.endsAt) ||
        a.id.localeCompare(b.id),
    );
    const start = cursor ? items.findIndex((o) => o.id === cursor.id) + 1 : 0,
      rows = items.slice(start, start + pageSize(limit)),
      last = rows.at(-1);
    return {
      items: rows,
      cursor:
        start + rows.length < items.length && last
          ? { at: last.endsAt, id: last.id, spotlight: last.isSpotlight }
          : null,
    };
  }
  const { nearby, ...rest } = filter;
  const { data, error } = await getSupabase()!.rpc("discover_offers", {
    p_filters: {
      ...rest,
      ...(nearby
        ? {
            latitude: nearby.latitude,
            longitude: nearby.longitude,
            radiusM: nearby.radiusM,
          }
        : {}),
    },
    p_cursor: cursor,
    p_limit: pageSize(limit),
  });
  if (error) throw new Error(friendlyOfferError(error.message));
  const page = parsePage(data);
  return { items: page.items.map(withBusiness), cursor: page.cursor };
}

/** Owner: all my offers, newest first. */
export type MyOfferFilter = "all" | "live" | "drafts" | "ended";
export async function listMyOffers(businessId: string): Promise<Offer[]> {
  return (await listMyOffersPage(businessId, "all", null, 80)).items;
}
export async function listMyOffersPage(
  businessId: string,
  filter: MyOfferFilter = "all",
  cursor: Cursor | null = null,
  limit = 30,
): Promise<Page<Offer>> {
  const now = new Date().toISOString(),
    size = pageSize(limit);
  if (useMock()) {
    const all = mockOffers
      .filter(
        (o) =>
          (o.businessId === businessId || o.businessId === "b1") &&
          (filter === "all" ||
            (filter === "live" && o.status === "live" && o.endsAt > now) ||
            (filter === "drafts" && o.status === "draft") ||
            (filter === "ended" &&
              (o.status === "ended" ||
                o.status === "cancelled" ||
                (o.status === "live" && o.endsAt <= now)))),
      )
      .sort(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
      );
    const start = cursor ? all.findIndex((o) => o.id === cursor.id) + 1 : 0,
      items = all.slice(start, start + size),
      last = items.at(-1);
    return {
      items,
      cursor:
        start + items.length < all.length && last
          ? { at: last.createdAt, id: last.id }
          : null,
    };
  }
  const db = getSupabase()!;
  let req = db
    .from("offers")
    .select(
      "*, business:profiles!offers_business_id_fkey(display_name,business_name)",
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(size + 1);
  if (filter === "live") req = req.eq("status", "live").gt("ends_at", now);
  if (filter === "drafts") req = req.eq("status", "draft");
  if (filter === "ended")
    req = req.or(
      "status.in.(ended,cancelled),and(status.eq.live,ends_at.lte." + now + ")",
    );
  if (cursor) {
    if (
      !/^[0-9a-f-]{36}$/i.test(cursor.id) ||
      !Number.isFinite(Date.parse(cursor.at))
    )
      throw new Error("Please refresh your offers.");
    req = req.or(
      "created_at.lt." +
        cursor.at +
        ",and(created_at.eq." +
        cursor.at +
        ",id.lt." +
        cursor.id +
        ")",
    );
  }
  const { data, error } = await req;
  if (error) throw new Error(friendlyOfferError(error.message));
  const items = (data ?? []).slice(0, size).map(withBusiness),
    last = items.at(-1);
  if (items.length) {
    const { data: counts, error } = await db.rpc("offer_booking_counts", {
      p_ids: items.map((o) => o.id),
    });
    if (error || !counts || typeof counts !== "object" || Array.isArray(counts))
      throw new Error("Could not load booking counts.");
    for (const o of items) o.activeBookings = Number(counts[o.id] ?? 0);
  }
  return {
    items,
    cursor:
      (data?.length ?? 0) > size && last
        ? { at: last.createdAt, id: last.id }
        : null,
  };
}

export async function getOffer(id: string): Promise<Offer | null> {
  if (useMock()) return mockOffers.find((o) => o.id === id) ?? null;
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from("offers")
    .select(
      "*, business:profiles!offers_business_id_fkey(display_name, business_name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(friendlyOfferError(error.message));
  return data ? withBusiness(data as Record<string, unknown>) : null;
}

/** Save as draft. Publishing is a separate, verification-gated step. */
export async function createDraft(
  businessId: string,
  input: NewOfferInput,
): Promise<Offer> {
  assertLive("create offers");
  const err = validateOfferInput(input);
  if (err) throw new Error(err);
  if (useMock()) {
    const created: Offer = {
      id: `mock-offer-${Date.now()}`,
      businessId,
      businessName: "Your Business",
      title: input.title.trim(),
      description: input.description.trim(),
      discountPct: input.discountPct ?? undefined,
      priceCents: input.priceCents ?? undefined,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      venueId: input.venueId,
      slotCapacity: input.slotCapacity,
      slotMinutes: input.slotMinutes ?? 60,
      resourceKey: input.resourceKey ?? "default",
      coverPhotoUrl: input.coverPhotoUrl ?? undefined,
      isSpotlight: input.isSpotlight ?? false,
      status: "draft",
      redemptions: 0,
      createdAt: new Date().toISOString(),
    };
    mockOffers.unshift(created);
    return created;
  }
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from("offers")
    .insert(toDb(input, businessId, "draft"))
    .select(
      "*, business:profiles!offers_business_id_fkey(display_name, business_name)",
    )
    .single();
  if (error) throw new Error(friendlyOfferError(error.message));
  return withBusiness(data as Record<string, unknown>);
}

/**
 * Publish a draft. Server (guard_offer_publish) rejects unless the business
 * is verified — the error surfaces here.
 */
export async function publishOffer(offerId: string): Promise<Offer> {
  assertLive("publish offers");
  if (useMock()) {
    const o = mockOffers.find((x) => x.id === offerId);
    if (!o) throw new Error("Offer not found.");
    if (o.status !== "draft") throw new Error("Only drafts can be published.");
    if (new Date(o.endsAt).getTime() <= Date.now())
      throw new Error("Offer expired.");
    o.status = "live";
    return o;
  }
  const supabase = getSupabase()!;
  const { data, error } = await supabase.rpc("update_offer", {
    p_offer_id: offerId,
    p_patch: { status: "live" },
  });
  if (error) throw new Error(friendlyOfferError(error.message));
  return withBusiness(data as Record<string, unknown>);
}

/** Edit a draft (or a live offer's non-status fields). */
/** Edit a draft (or a live offer's non-status fields). Pass null to clear discount/price. */
export async function updateOffer(
  offerId: string,
  input: Omit<Partial<NewOfferInput>, "discountPct" | "priceCents"> & {
    discountPct?: number | null;
    priceCents?: number | null;
  },
): Promise<Offer> {
  assertLive("edit offers");
  const dbPatch: Record<string, unknown> = {};
  if (input.title !== undefined) dbPatch.title = input.title.trim();
  if (input.description !== undefined)
    dbPatch.description = input.description.trim();
  if (input.discountPct !== undefined)
    dbPatch.discount_pct = input.discountPct ?? null;
  if (input.priceCents !== undefined)
    dbPatch.price_cents = input.priceCents ?? null;
  if (input.startsAt !== undefined) dbPatch.starts_at = input.startsAt;
  if (input.endsAt !== undefined) dbPatch.ends_at = input.endsAt;
  if (input.venueId !== undefined) dbPatch.venue_id = input.venueId ?? null;
  if (input.slotCapacity !== undefined)
    dbPatch.slot_capacity = input.slotCapacity;
  if (input.slotMinutes !== undefined) dbPatch.slot_minutes = input.slotMinutes;
  if (input.resourceKey !== undefined) dbPatch.resource_key = input.resourceKey;
  if (input.coverPhotoUrl !== undefined)
    dbPatch.cover_photo_url = input.coverPhotoUrl;
  if (input.isSpotlight !== undefined) dbPatch.is_spotlight = input.isSpotlight;

  if (useMock()) {
    const o = mockOffers.find((x) => x.id === offerId);
    if (!o) throw new Error("Offer not found.");
    Object.assign(o, {
      title: input.title?.trim() ?? o.title,
      description: input.description?.trim() ?? o.description,
      discountPct:
        input.discountPct === undefined
          ? o.discountPct
          : (input.discountPct ?? undefined),
      priceCents:
        input.priceCents === undefined
          ? o.priceCents
          : (input.priceCents ?? undefined),
      startsAt: input.startsAt ?? o.startsAt,
      endsAt: input.endsAt ?? o.endsAt,
      slotCapacity: input.slotCapacity ?? o.slotCapacity,
      slotMinutes: input.slotMinutes ?? o.slotMinutes,
      resourceKey: input.resourceKey ?? o.resourceKey,
      venueId: input.venueId ?? o.venueId,
      coverPhotoUrl:
        input.coverPhotoUrl === undefined
          ? o.coverPhotoUrl
          : (input.coverPhotoUrl ?? undefined),
      isSpotlight: input.isSpotlight ?? o.isSpotlight,
    });
    return o;
  }
  const supabase = getSupabase()!;
  const { data, error } = await supabase.rpc("update_offer", {
    p_offer_id: offerId,
    p_patch: dbPatch,
  });
  if (error) throw new Error(friendlyOfferError(error.message));
  return withBusiness(data as Record<string, unknown>);
}

/** Delete a draft offer. Only drafts with no bookings can be deleted. */
export async function deleteOffer(offerId: string): Promise<void> {
  assertLive("delete offers");
  if (useMock()) {
    const i = mockOffers.findIndex((x) => x.id === offerId);
    if (i < 0) throw new Error("Offer not found.");
    if (mockOffers[i].status !== "draft")
      throw new Error("Only drafts can be deleted.");
    mockOffers.splice(i, 1);
    return;
  }
  const supabase = getSupabase()!;
  const { error } = await supabase.rpc("delete_offer", {
    p_offer_id: offerId,
  });
  if (error) throw new Error(friendlyOfferError(error.message));
}

/** End an offer early. Terminal for customers; business keeps history. */
export async function cancelOffer(offerId: string): Promise<void> {
  assertLive("cancel offers");
  if (useMock()) {
    const o = mockOffers.find((x) => x.id === offerId);
    if (!o) throw new Error("Offer not found.");
    o.status = "cancelled";
    for (const b of mockBookings)
      if (
        b.offerId === offerId &&
        (b.status === "pending" ||
          (b.status === "confirmed" && new Date(b.slot).getTime() > Date.now()))
      )
        b.status = "cancelled";
    return;
  }
  const supabase = getSupabase()!;
  const { error } = await supabase.rpc("update_offer", {
    p_offer_id: offerId,
    p_patch: { status: "cancelled" },
  });
  if (error) throw new Error(friendlyOfferError(error.message));
}

export function friendlyOfferError(message: string): string {
  if (/overlap|resource already booked/i.test(message))
    return "This court or service already has an offer during these times. Choose another time or separately available capacity.";
  if (message.toLowerCase().includes("verified"))
    return "Only verified businesses can publish offers. Submit your verification documents first.";
  return message;
}

/** Live discovery changes shared by mounted consumers. */
export function subscribeToOffers(onChange: () => void): () => void {
  if (useMock()) return () => {};
  return multiplexSubscribe(
    "offers-feed",
    (channel, fire) =>
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "offers",
        },
        () => fire(),
      ),
    onChange,
    // Every plan/offer change in every city arrives here: refresh calmly.
    LIVE_FEED_CALM,
  );
}
