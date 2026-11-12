# Admin account controls

The existing Operations dashboard supports business and selfie verification, safety reports, account review, suspension/restore, pending account-deletion management and decision history. Accounts can be filtered by All, Suspended, Deletion requested or Active. Manage opens account details from Accounts or the Operations deletion queue.

Account changes require an active owner administrator, a confirmed sign-in, authenticator verification and a written reason (up to 200 characters). Moderators may inspect accounts but cannot perform account changes. Every successful account action records its actor, target, decision and reason. Ordinary app sessions cannot invoke the database action directly. Active administrators cannot be suspended using account controls.

## Deletion cancellation

Cancellation is allowed only before the deletion worker has ever claimed the request. A worker starts removing files before `prepared_at` is set, so a non-null lease, any previous attempt or a prepared job prevents cancellation. The database locks the same job row used by the worker claim. A missing job fails closed. The dashboard hides the cancellation action for started or unavailable jobs; server validation also protects against stale screens.

Cancelling clears the deletion request and its unstarted job. It does not restore plans or bookings cancelled when deletion was requested. Restore account clears a suspension; it does not recreate cancelled commitments. Starting deletion on behalf of an account owner is not part of these controls.

## Deploy an existing project

1. Apply only unapplied numbered migrations. Projects with **00033 already applied** need only `supabase/migrations/00034_admin_deletion_cancellation_safety.sql`. Migration 00034 replaces the decision function and changes no account rows. Do not rerun 00033, and never run `supabase/run-all.sql` against an existing project. The generated bundle is for fresh databases only.
2. Deploy the updated handler: `supabase functions deploy admin-console --project-ref YOUR_PROJECT_REF --no-verify-jwt --use-api`. The handler independently validates the Supabase session, active admin allowlist, role, account status, authenticator assurance and allowed browser origin. Keep `ADMIN_ALLOWED_ORIGINS` restricted to the existing dashboard origin.
3. Build with public Supabase configuration only: `npm run admin:build` (reads `.env`). Publish `dist-admin` to the existing dashboard host, preserving its current audience. Never include a service-role key, private review media, admin sessions or `.env` in the static output.

## Verification

`npm run sql:check`, `npm run typecheck`, `npm test` and `npm run admin:build` cover the bundle, handler, UI request ordering, permissions and database actions. CI also runs the database suite against disposable PostGIS. These tests never operate on real user accounts.

After deployment, verify sign-in and authenticator verification, filter accounts, open Manage, inspect business request details and view Decision history. Live verification should be read-only unless using a deliberately disposable account. API calls without a valid admin session must fail; cross-origin requests must be rejected.
