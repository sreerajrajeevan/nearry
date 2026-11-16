# Business and venue verification

A request now includes a private proof image and an owner-confirmed venue name,
category, area, full public address and exact coordinates. The location comes
from the device while at the business, or coordinates entered by the owner.
Provider-derived search coordinates are not copied into the permanent directory.

The request stores a frozen location snapshot on its private review job. Editing
profile details afterwards cannot change the address/pin being reviewed. The
admin dashboard and emailed review page show this snapshot and a Google Maps
link. Approval requires the operator to confirm they checked the address/pin
against the business proof.

Approval and venue creation/linking commit in the same database transaction.
A venue is created for the business, or its existing owned venue is updated,
and older offers missing a venue are attached. Existing linked offers, slot IDs,
bookings and conversations remain intact. New drafts inherit the venue on the
server; publishing without a linked venue is rejected even on an old app build.
Venue ownership and location cannot be edited directly by a business client.

Existing verified businesses without venues can submit the missing location
for review. Old pending proof-only requests can be replaced with a complete
request; their old review links stop working. Admins can reject incomplete old
requests, but cannot approve them without a new complete submission. This change
does not approve any existing business or infer locations from unreviewed data.

## Rollout after merging

1. Apply `supabase/migrations/00044_business_venue_verification.sql` through the
   normal migration workflow (or the generated `supabase/run-all.sql`).
2. Deploy `admin-console` and `review-verification` using the existing project
   configuration and authentication settings.
3. Build the admin assets with `node scripts/build-admin.mjs`, using the usual
   public Supabase environment variables, and replace the hosted `dist-admin`.
4. Build the updated phone app for testing. Older phone builds receive an
   instruction to update if they attempt a proof-only submission.

## Acceptance checks on phones

- Submit a business with the correct name, public address, pin and proof. Denied
  GPS permission leaves the coordinate-entry option available.
- Confirm the admin sees exactly that address/pin. Rejecting does not create a
  venue; approving creates one and unlocks publishing.
- Create another offer without entering a venue. Check it uses the approved
  venue and appears when a nearby area is selected.
- Try a verified legacy account without a venue. It must complete the location
  review before publishing.
- Verify a legacy offer's bookings and chat are unchanged after its venue is
  attached. Changes to approved location require a further reviewed workflow;
  there is no client-side ownership/location override.
