# Plans with a business offer

## Scope and rollout

This first version lets a personal host attach one live, fixed-price offer and
business-defined slot to a new plan. Existing plans and ordinary bookings keep
their current flows. Businesses continue to manage reservations in Bookings.
Business-authored community plans and in-app payments are outside this version.

Creation is off by default in both the app and the database. No live migration,
feature activation, Play deployment, or merge is part of this PR.

1. Apply only migration `00051_plan_offer_bundles.sql` to a staging project.
   `run-all.sql` is only for a fresh database.
2. Use the `bundle-preview` EAS profile (APK, preview environment), with staging
   Supabase environment variables. It sets `EXPO_PUBLIC_PLAN_OFFER_BUNDLES=true`.
   Production and Play testing keep their existing default, with this feature off.
3. As the database operator, run:
   `update public.plan_offer_settings set enabled=true where singleton=true;`
4. Ensure the existing `expire_booking_holds()` job runs every minute under a
   trusted service role. Its cancellations also close linked plans.
5. Test the scenarios below before enabling creation in a release build.
   Set the database flag false to stop new bundles. Existing reservations and
   their lifecycle protections remain active even when creation is disabled.

## Reservation and pricing rules

- One plan reserves the selected resource/time block exclusively, including the host plus all advertised
  vacancies (2–50 people in total). Choose an empty slot; existing reservations
  cannot be moved into a plan. Other plans and ordinary bookings cannot claim
  the same resource/time block. It never creates one court booking per join.
- The host requests that whole capacity when publishing. A transaction creates
  the post, reservation and immutable offer snapshot together, or none of them.
- The business has the existing 30-minute hold window (or until the slot starts,
  whichever comes first) to confirm. Requests/approvals do not confirm the venue.
- Approved participants join the existing plan group automatically. Already
  approved members receive a plan-linked notice when the venue confirms. Pending
  requests do not consume additional venue seats. Leaving reopens a plan spot;
  the group's original venue allocation stays reserved for a replacement.
- Prices are copied from the offer, per person, and fixed for this reservation.
  The group total covers the full reserved capacity; the host is responsible for
  that total, even if the group does not fill. Payment happens at the venue.
- Cancelling the plan releases its reservation. Venue cancellation, an expired
  hold, or removal of the reservation cancels the linked plan. Participants are
  notified through the existing cancellation flow. There are no online refunds.
- Expired holds stop requests and approvals immediately, even before scheduled
  cleanup marks the booking cancelled. Do not treat a pending venue as confirmed.
- Venue, slot, duration, capacity and price cannot be edited after publishing;
  cancel and create another plan to change them. Other edits keep existing rules.
- Retry keys prevent duplicate plans/reservations after a lost mobile response.
- The existing business → offer → slot locking order and capacity sums cover
  regular bookings and group bookings together. Existing ordinary-booking
  limits (2 people, 3 pending requests, one offer/day) remain unchanged. Bundles
  count toward the host's pending-request and offer/day limits too.

## Verification

Run `npm run sql:check`, `npm run typecheck`, and `npm test`. The database suite
runs migrations in a disposable database; use `TEST_DATABASE_URL` pointing only
to a database named `nearry_test` for real PostgreSQL/PostGIS concurrency tests.

Phone staging checklist: attach/remove an offer; retry failed loading; select a
slot; reject a group larger than capacity; verify venue/time/price fill; publish
with and without a cover; confirm/decline as the business; request/approve/leave;
check group chat and vacancy count; cancel from both sides; let a hold expire;
retry publication after a lost response; test older app joins and ordinary plans.
