import { assertLive } from "./demoGuard";
import { isDemoMode, requireSupabase } from "./supabase";
import type { NewPostInput } from "./mappers";
import type { PlanOfferBundle } from "../utils/planOfferBundle";

// Expo replaces this explicit property access at build time. Creation stays opt-in.
export const PLAN_OFFER_BUNDLES =
  process.env.EXPO_PUBLIC_PLAN_OFFER_BUNDLES === "true";
const columns =
  "post_id,plan_title,booking_id,business_name,offer_title,venue_name,starts_at,ends_at,party_size,price_cents,status,hold_expires_at";
type BundleRow = {
  plan_title: string;
  post_id: string;
  booking_id: string | null;
  business_name: string;
  offer_title: string;
  venue_name: string;
  starts_at: string;
  ends_at: string;
  party_size: number;
  price_cents: number;
  status: PlanOfferBundle["status"];
  hold_expires_at: string | null;
};
const mapBundle = (row: BundleRow): PlanOfferBundle => ({
  planTitle: row.plan_title,
  postId: row.post_id,
  bookingId: row.booking_id ?? undefined,
  businessName: row.business_name,
  offerTitle: row.offer_title,
  venueName: row.venue_name,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  partySize: row.party_size,
  priceCents: row.price_cents,
  status: row.status,
  holdExpiresAt: row.hold_expires_at ?? undefined,
});
// An older backend is supported when the additive migration has not been applied.
const migrationMissing = (error: { code?: string }) =>
  error.code === "PGRST205" || error.code === "42P01";

export async function bundleCreationAvailable(): Promise<boolean> {
  if (!PLAN_OFFER_BUNDLES || isDemoMode()) return false;
  const { data, error } = await requireSupabase().rpc(
    "plan_offer_bundles_enabled",
  );
  if (error)
    throw new Error(
      "Plans with offers are not available yet. You can still create a regular plan.",
    );
  return data === true;
}

/** Read existing bundles even when creation is switched off. */
export async function getPlanOfferBundle(
  postId: string,
): Promise<PlanOfferBundle | null> {
  if (isDemoMode()) return null;
  const { data, error } = await requireSupabase()
    .from("plan_offer_bundles")
    .select(columns)
    .eq("post_id", postId)
    .maybeSingle();
  if (error && migrationMissing(error)) return null;
  if (error)
    throw new Error(
      "Could not check the venue reservation. Please retry before joining.",
    );
  return data ? mapBundle(data as BundleRow) : null;
}

export async function listBookingPlanBundles(
  bookingIds: string[],
): Promise<PlanOfferBundle[]> {
  if (isDemoMode() || !bookingIds.length) return [];
  const result: PlanOfferBundle[] = [];
  for (let start = 0; start < bookingIds.length; start += 100) {
    const { data, error } = await requireSupabase()
      .from("plan_offer_bundles")
      .select(columns)
      .in("booking_id", bookingIds.slice(start, start + 100));
    if (error && migrationMissing(error)) return [];
    if (error) throw new Error(error.message);
    result.push(...((data ?? []) as BundleRow[]).map(mapBundle));
  }
  return result;
}

export async function createPlanOfferBundle(
  slotId: string,
  input: NewPostInput,
  clientKey: string,
  expectedPriceCents: number,
): Promise<string> {
  assertLive("create a plan with an offer");
  if (!PLAN_OFFER_BUNDLES)
    throw new Error("Plans with offers are not enabled in this build.");
  const { data, error } = await requireSupabase().rpc(
    "create_plan_offer_bundle",
    {
      p_slot_id: slotId,
      p_client_key: clientKey,
      p_expected_price_cents: expectedPriceCents,
      p_post: {
        title: input.title.trim(),
        description: input.description.trim(),
        vacancies: input.vacancies,
        tags: input.tags,
        gender_preference: input.genderPreference ?? "any",
        plan_details: input.planDetails ?? {},
        expires_at: input.expiresAt ?? null,
      },
    },
  );
  if (error) throw new Error(error.message);
  if (!data?.post_id)
    throw new Error(
      "Could not confirm publication. Retry to check the same request.",
    );
  return data.post_id as string;
}
