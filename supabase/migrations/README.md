# Apply migrations safely

Never run `run-all.sql` against an existing project. It is generated, fresh-install-only and protected by a transaction and existing-schema guard.

For a fresh database, run `run-all.sql`, or apply `00001` through `00014` once in order. For an existing project, inspect its migration history and apply **only missing** numbered migrations in order. Back up the project first. Do not replay old migrations.

For a project already on `00010`, apply `00011`, `00012`, `00013`, `00014`. These are forward migrations. Existing posts, profiles, offers and bookings are preserved. New columns and grants require deploying the matching app build together with these migrations.

If upgrading an original pre-chat database, `00010` now archives its old messages/threads/notifications as `legacy_messages`, `legacy_threads`, `legacy_notifications`. Records remain available to administrators and are not automatically shown in the new conversation interface. This revised fresh/legacy install path must never be replayed on a project where `00010` is already applied.

`00011`: authorized join lifecycle, consistent counts, profile privacy, first-time role selection and safe cancellation.

`00012`: stable slots generated from each offer's window/duration; legacy bookings retain timestamps and are assigned slot IDs. Existing pending bookings have no new hold deadline; only new requests have a 30-minute confirmation hold. New bookings cannot use arbitrary timestamps. Archived/overlapping legacy slots are protected by overlap checks. Live slot definitions cannot be rescheduled; create a new draft instead. Resource names distinguish courts/stylists; using the same name blocks overlapping live offers at one business.

`00013`: server push outbox, token registration and realtime publication. Older duplicate token registrations are consolidated to the newest account registration. Existing public push function callers are disabled in the new app; deploy the secret-authenticated worker as part of the upgrade.

`00014`: spatial venue results with distances and refreshed business booking view.

Schedule `close_expired_posts()` and `expire_booking_holds()` with a trusted service role every minute. New approvals/bookings/confirmations independently enforce expiry even if the scheduler is delayed. Never put a service-role key in the app.

Venue ownership changes require administrative review. After checking submitted proof, an administrator may set `venues.business_id`. There is no immediate self-service claim path.

`npm run sql:generate` regenerates the fresh-install bundle. `npm run sql:check` verifies it matches the migrations.
