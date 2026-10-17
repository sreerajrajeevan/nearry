import { getSupabase, isSupabaseConfigured, isDemoMode } from "./supabase";
import { multiplexSubscribe } from "./realtime";
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
      display_name: b?.business_name || b?.display_name || "Business",
    },
  });
}

/** Public: live offers, soonest-ending first. */
export async function listLiveOffers(venueIds?: string[]): Promise<Offer[]> {
  if (useMock())
    return mockOffers.filter(
      (o) =>
        o.status === "live" &&
        (!venueIds || venueIds.includes(o.venueId ?? "")),
    );
  if (venueIds && !venueIds.length) return [];
  const supabase = getSupabase()!;
  let query = supabase
    .from("offers")
    .select(
      "*, business:profiles!offers_business_id_fkey(display_name, business_name)",
    )
    .eq("status", "live")
    .gt("ends_at", new Date().toISOString())
    .order("ends_at");
  if (venueIds) query = query.in("venue_id", venueIds);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(withBusiness);
}

/** Owner: all my offers, newest first. */
export async function listMyOffers(businessId: string): Promise<Offer[]> {
  if (useMock())
    return mockOffers.filter(
      (o) => o.businessId === businessId || o.businessId === "b1",
    );
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from("offers")
    .select(
      "*, business:profiles!offers_business_id_fkey(display_name, business_name)",
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(withBusiness);
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
  if (error) throw new Error(error.message);
  return data ? withBusiness(data as Record<string, unknown>) : null;
}

/** Save as draft. Publishing is a separate, verification-gated step. */
export async function createDraft(
  businessId: string,
  input: NewOfferInput,
): Promise<Offer> {
  const err = validateOfferInput(input);
  if (err) throw new Error(err);
  if (useMock()) {
    const created: Offer = {
      id: `mock-offer-${Date.now()}`,
      businessId,
      businessName: "Your Business",
      title: input.title.trim(),
      description: input.description.trim(),
      discountPct: input.discountPct,
      priceCents: input.priceCents,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      venueId: input.venueId,
      slotCapacity: input.slotCapacity,
      slotMinutes: input.slotMinutes ?? 60,
      resourceKey: input.resourceKey ?? "default",
      status: "draft",
      redemptions: 0,
      createdAt: new Date().toISOString(),
    };
    mockOffers.unshift(created);
    return created;
  }
  const supabase = getSupabase()!;
  // One draft per title: reuse an existing draft instead of duplicating it
  // (e.g. after a failed publish attempt).
  const { data: existing } = await supabase
    .from("offers")
    .select("id")
    .eq("business_id", businessId)
    .eq("status", "draft")
    .ilike("title", input.title.trim())
    .limit(1)
    .maybeSingle();
  if (existing) return updateOffer(existing.id as string, input);
  const { data, error } = await supabase
    .from("offers")
    .insert(toDb(input, businessId, "draft"))
    .select(
      "*, business:profiles!offers_business_id_fkey(display_name, business_name)",
    )
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
export async function updateOffer(
  offerId: string,
  input: Partial<NewOfferInput>,
): Promise<Offer> {
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

  if (useMock()) {
    const o = mockOffers.find((x) => x.id === offerId);
    if (!o) throw new Error("Offer not found.");
    Object.assign(o, {
      title: input.title?.trim() ?? o.title,
      description: input.description?.trim() ?? o.description,
      discountPct: input.discountPct ?? o.discountPct,
      priceCents: input.priceCents ?? o.priceCents,
      startsAt: input.startsAt ?? o.startsAt,
      endsAt: input.endsAt ?? o.endsAt,
      slotCapacity: input.slotCapacity ?? o.slotCapacity,
      slotMinutes: input.slotMinutes ?? o.slotMinutes,
      resourceKey: input.resourceKey ?? o.resourceKey,
      venueId: input.venueId ?? o.venueId,
    });
    return o;
  }
  const supabase = getSupabase()!;
  const { data, error } = await supabase.rpc("update_offer", {
    p_offer_id: offerId,
    p_patch: dbPatch,
  });
  if (error) throw new Error(error.message);
  return withBusiness(data as Record<string, unknown>);
}

/** Delete a draft offer. Only drafts with no bookings can be deleted. */
export async function deleteOffer(offerId: string): Promise<void> {
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
  if (error) throw new Error(error.message);
}

/** End an offer early. Terminal for customers; business keeps history. */
export async function cancelOffer(offerId: string): Promise<void> {
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
  if (error) throw new Error(error.message);
}

function friendlyOfferError(message: string): string {
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
  );
}
