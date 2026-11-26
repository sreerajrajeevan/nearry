# Apply migrations safely

Never run `run-all.sql` against an existing project. It is generated, fresh-install-only and protected by a transaction and existing-schema guard.

For a fresh database, run `run-all.sql`, or apply every current .sql file once in lexicographic filename order. For an existing project, inspect its migration history and apply **only missing** numbered migrations in order. Back up the project first. Do not replay old migrations.

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

`00020`: owner-authorized deletion of draft offers without bookings.

`00021`: core journeys: atomic unread counts, message notice read tracking, participant notifications on post cancellation, and safe reservation retries. Apply after `00020`; use the matching app for the new badge RPC. Existing records are retained.

## Account safety and notifications (00024–00025)

Existing projects at 00023 apply only `00024_account_safety.sql` and `00025_push_delivery_receipts.sql`, in order, before distributing the matching client. These add report/block rules, account deactivation/deletion queues, terms acknowledgement, notification preferences and delivery receipts. Deploy/redeploy `account-maintenance` and `send-push`, configure trusted schedules, and set public legal/EAS configuration. See [rollout and operator instructions](../../docs/account-safety-rollout.md). Existing future commitments are not cancelled by migration installation; cancellation happens only after an explicit deletion request or a trusted moderation action.

## Admin operations console (00029)

`00029_admin_console.sql` creates private admin membership, audit records and
service-only overview, business queue and moderation functions. Apply after
00028; allowlist confirmed operator UUIDs separately and deploy `admin-console`.
See [admin setup](../../admin/README.md). The old unmerged admin migration 00027
was renumbered. After the November reliability update, email review links hand off to this authenticated MFA dashboard. Never grant ordinary
clients access to admin tables or let users add themselves as administrators.

- **00030_personal_selfie_verification.sql** — optional private camera selfie reviews, versioned admin decisions, current-avatar binding and cleanup. Requires 00029. See [selfie setup](../../docs/personal-selfie-verification.md). New camera and immutable avatar paths require a fresh phone build.

`00039`: optional join request note (up to 280 characters), readable only by the requester and the host. Replaces `request_join(uuid)` with `request_join(uuid, text default null)`; apply it before or with the matching app build. Older builds still call it with one argument, which keeps working; the new build only sends a note when the person writes one.

`00040`: random pose for the optional selfie check. Adds `selfie_poses()`, a private `personal_selfie_challenges` table, `start_selfie_challenge()` and `submit_personal_selfie(text, boolean, uuid)`; the reviewer queue now returns `pose_label`. The two-argument submit stays for older builds (no pose). Wraps `maintenance_retention_cleanup()` to remove old challenges. Apply it before releasing the matching app build, and deploy the updated `admin/` dashboard at the same time. **Since November 2026 the app no longer asks for a pose**: it submits a plain selfie through the two-argument call and the dashboard no longer shows a pose. The pose functions stay in the database, unused and harmless; no migration is needed to remove them.

`00041`: fair-use limits on offer bookings in `book_offer_slot`: at most 2 people per booking, one active booking per person per offer per day (India time), and at most 3 waiting (unconfirmed) requests per person. A retry of the same slot still returns the existing booking. Apply it before or with the matching app build.

`00042`: plan-group notification previews show `Sender: message` under the existing group title. Backfills previews from retained messages while preserving read state and timestamps; does not resend pushes or alter chat messages. Device push text stays generic. Apply this migration to an existing project; no app rebuild is required.

`00048`: clearer booking notifications. "Booking confirmed" now names the business, the slot time (India time) and party size, and says to pay at the venue: the total for the party plus the per-person price (offer prices are per person), or "It's free". Business requests and cancellations also show the slot time. Only the text changes: kinds, recipients and the offer reference are the same, so older app builds are unaffected and existing notifications are not rewritten. Numbered 00048 because the unmerged `feat/premium` branch already uses 00046–00047; it does not depend on them.

`00049`: business chats show the business name. `list_my_conversations()` adds `other_is_business` and `other_business_name`; `conversation_safety()` adds `isBusiness`, `businessName`, `kind` and `contextTitle`; message notifications from a business read "Message from <business name>". Additive only, so older builds keep working; the new chat header, list tags and tappable links need the matching app build. Numbered 00049 because open branches use 00046–00048; it does not depend on them.

## November reliability update (00050, 00052–00054)

See [rollout instructions and validation](../../docs/review-fix-tracker.md). Apply the four new forward files before the matching app/worker release. Existing content and history are retained. The stale milestone schema.sql has been removed; run-all.sql is the only generated fresh-install bundle.

Historical duplicate numeric prefixes (00021 and 00025) are ordered by the full filename in this repository. Do not rename or replay applied files. Record the full filename when applying manually, and inspect the target database's actual objects and migration history before importing it into a migration tool that requires unique numeric versions. Reserved numbers for independent branches are not missing dependencies.

## Plan chat join and leave lines (00055)

Adds `plan_group_events`, written by a trigger on `join_requests` whenever someone becomes an approved member (`joined`) or stops being one (`left` when they withdraw, `removed` otherwise). Members of the plan's group can read it; nobody can write to it directly. Lines start from the moment this file is applied; earlier joins are not back-filled.

## Abuse limits (00056)

Database-enforced spam limits that also hold for direct API calls: 10 plans a day, 40 join requests an hour, 30 chat messages a minute, 30 offers a day (signed-in writers only; workers and admins are not limited, and new plan timestamps are stamped by the server). Adds length limits on profile name (100), business name (120) and bio (500); restricts the avatars, photos and verification_docs buckets to JPEG/PNG/WebP up to 10 MB; revokes signed-out access to internal helper functions and push tokens, and the unused update grant on messages.

## Daily cleanup (00057)

`daily_cleanup()` removes photos of plans that started more than 7 days ago (the files and thumbnails are queued for the storage worker; the plans stay), notifications older than 90 days, and pg_cron run history older than 7 days. Schedule it once a day with `supabase/ops/setup-maintenance.sql` (`nearry-daily-cleanup`, 21:30 UTC = 3:00 am India time).

## Policy and index tidy-up (00058)

Rewrites every `public` row-security rule so `auth.uid()` is read once per query (`(select auth.uid())`) instead of once per row; the rules mean the same thing. Adds indexes for the foreign keys the Supabase advisor flagged (and, where they exist, the legacy tables from the first schema). Applied live on 24 Nov 2026.

## Plan reminders (00059)

Same-day reminders for plans: `send_plan_reminders()` (every 10 minutes via `supabase/ops/setup-maintenance.sql`, job `nearry-plan-reminders`) notifies the host and approved members at 8:00 am India time, or 2 hours before an earlier start, once per person per plan, through the normal push pipeline (`plan_reminder` kind). Members answer with `set_plan_attendance` (stored in `plan_attendance`); hosts read `plan_attendance_summary`; the app's "Plans for today" pop-up reads `plans_for_day`. Design: `docs/superpowers/specs/2026-11-24-plan-reminders-design.md`.

## Players needed (00060)

Numbered 00060 so it applies after 00055–00059. Adds per-person notification switches (messages, plan requests and updates, bookings, nearby players needed) that gate push, keeps the area chosen at sign-up or in settings until the person removes it (GPS areas rounded to about 1 km, including ones already saved), urgent plans that alert eligible people nearby, and auto-accept. Additive: old builds keep working. Rollout: apply after the matching app build is released (older builds are unaffected), then turn on GitHub Pages for the `gh-pages` branch so venue QR cards open.

## Offer duplicates and party size (00061)

- A business can publish different offers at the same time. Publishing is
  blocked only for a duplicate: same title (ignoring case and spaces) on the
  same court or service name at overlapping times.
- Offers that only share the default court name ("Main") no longer block each
  other's bookings; offers that name the same court still share it.
- A booking can be for 1 to 4 people (was 1 or 2).

Numbered 00061 so it applies after 00057–00060. Safe to apply before the app
update: older apps still cap bookings at 2 people.

## Smaller image limits (00062)

Profile photos are capped at 2 MB and plan/venue photos at 5 MB (were 10 MB).
The app now uploads profile photos at 512 px and plan photos at 1280 px with a
480 px thumbnail, about 70% JPEG quality. Older app versions stay well under
the caps.

## Booking reminders (00063)

On the day of a confirmed offer booking, the customer gets one push at 8:00 am
India time, or 2 hours before an earlier slot: "Today: <offer> · 6:00 pm at
<venue> · 2 people. Can't make it? Cancel it in the app…". Pending and
cancelled bookings get none. New notification kind `booking_reminder` under the
Bookings switch; `booking_reminder_log` records each booking reminded.
Schedule `nearry-booking-reminders` (every 10 minutes) from
`ops/setup-maintenance.sql`.

## Co-ride plans (00064)

Adds the plan type `ride` ("Co-ride") with an optional `rideMode` of `bike` or
`car` (absent = either), allowed only on a ride. Only widens what plan details
accept; existing plans are unaffected.

## Push worker fix (00065)

`claim_push_jobs` from 00050 returned a data-modifying `WITH` from inside a
subquery, which Postgres rejects, so from 23 Nov 2026 every `send-push` run
failed and no push was delivered. It's now a top-level statement. Pushes for
notifications older than 12 hours are closed as "too old to push" (the in-app
notification stays). `push_work_due()` lets the every-minute dispatcher skip
calling `send-push` when nothing is waiting; the live cron command is
`select public.dispatch_nearry_push() where public.push_work_due();`. The daily
cleanup now keeps 2 days of pg_cron history instead of 7.
