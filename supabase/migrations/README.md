# Apply migrations safely

Never run `run-all.sql` against an existing project. It is generated, fresh-install-only and protected by a transaction and existing-schema guard.

For a fresh database, run `run-all.sql`, or apply `00001` through `00019` once in order. For an existing project, inspect its migration history and apply **only missing** numbered migrations in order. Back up the project first. Do not replay old migrations.

For a project already on `00010`, apply `00011` through `00018` in order. These are forward migrations. Existing posts, profiles, offers and bookings are preserved. New columns and grants require deploying the matching app build together with these migrations.

If upgrading an original pre-chat database, `00010` now archives its old messages/threads/notifications as `legacy_messages`, `legacy_threads`, `legacy_notifications`. Records remain available to administrators and are not automatically shown in the new conversation interface. This revised fresh/legacy install path must never be replayed on a project where `00010` is already applied.

`00011`: authorized join lifecycle, consistent counts, profile privacy, first-time role selection and safe cancellation.

`00012`: stable slots generated from each offer's window/duration; legacy bookings retain timestamps and are assigned slot IDs. Existing pending bookings have no new hold deadline; only new requests have a 30-minute confirmation hold. New bookings cannot use arbitrary timestamps. Archived/overlapping legacy slots are protected by overlap checks. Live slot definitions cannot be rescheduled; create a new draft instead. Resource names distinguish courts/stylists; using the same name blocks overlapping live offers at one business.

`00013`: server push outbox, token registration and realtime publication. Older duplicate token registrations are consolidated to the newest account registration. Existing public push function callers are disabled in the new app; deploy the secret-authenticated worker as part of the upgrade.

`00014`: spatial venue results with distances and refreshed business booking view.

Schedule `close_expired_posts()` and `expire_booking_holds()` with a trusted service role every minute. New approvals/bookings/confirmations independently enforce expiry even if the scheduler is delayed. Never put a service-role key in the app.

Venue ownership changes require administrative review. After checking submitted proof, an administrator may set `venues.business_id`. There is no immediate self-service claim path.

`npm run sql:generate` regenerates the fresh-install bundle. `npm run sql:check` verifies it matches the migrations.

`00015`: profile column grants needed by onboarding and post guards.

`00016`: legacy email-review trigger. Always continue through `00018` before accepting proof submissions; `00018` replaces the network trigger with a private queue.

`00017`: complete slot-window validation, authorized offer-update RPC, cancellation of future reservations, retained customer offer context, server-owned chat timestamps/read cursors, and notifications on resubmitted join requests. Existing cancelled offers have pending/future confirmed bookings cancelled during this migration. Historical confirmed bookings in the past are preserved. Deploy the matching client: old builds using raw offer updates will be denied.

`00018`: private verification review queue, service-only claim/review RPCs, atomic status/notification writes, and invalidation of old submission links. Pending proofs are queued for new email delivery. Deploy both updated verification functions and configure the scheduler using [server setup](../functions/README.md). The old email function must not remain in service.

For projects already on `00016`, apply only `00017` and `00018` after taking a backup and reviewing the future-booking cancellation above. Run the app and worker changes together in staging before production. Applied migrations are not edited by these fixes.

`00019`: private server-only place-search quota counters and an atomic reservation RPC. This does not import, replace or claim venues. Deploy the `place-search` function with its server-only Geoapify secret; see [place search setup](../../docs/place-search.md). Projects at `00018` apply only `00019`.

`00020`: core journeys: atomic unread counts, message notice read tracking, participant notifications on post cancellation, and safe reservation retries. Apply after `00019`; use the matching app for the new badge RPC. Existing records are retained.
