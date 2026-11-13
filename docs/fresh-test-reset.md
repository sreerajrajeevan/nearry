# Fresh testing reset

PR #41 remains the selected UI. Merging this PR **does not delete any data**.
The reset is a separate, manually confirmed operator action. It is not a
migration, app feature, scheduled task, build hook or CI step.

## Reviewed scope

Project: Nearry (`ggeejgykahzquynwighw`).

- Permanently remove non-admin Auth accounts and their profiles, login identities
  and sessions. Those testers must sign up again, including Google users.
- Clear all posts, venues (including test/seed venues), offers, bookings, join
  requests, conversations, messages, notifications, blocks, reports, verification
  submissions, deletion/media/push queues and old administration decision history.
- Remove uploaded photos, avatars, business documents and selfie proofs through
  the Storage API, before deleting accounts. Never delete `storage.objects`
  directly: that can orphan the actual stored files.
- Preserve all existing admin sign-ins, passwords/Google identities, MFA and the
  admin allowlist. The active owner `cocsreeraj@gmail.com` must exist. The retained
  admin profiles remain; old avatar/document links are cleared with the files.
- Preserve schema, RLS, functions, migrations, storage buckets and policies,
  secrets, Google search/billing configuration, project configuration, geographic
  reference data and aggregate provider cost/quota counters. Remove per-user
  search counters.

This cannot be undone by the app. It is intended only while the operator has
confirmed that the current project data is disposable testing data. Stop phone
testing and background writers while the reset runs. New writes/account changes
can invalidate the reviewed inventory or make verification fail.

## Operator workflow

Use an existing authorized Supabase CLI login. No server key belongs in the app,
Git, a PR, logs or a static dashboard. The tool reads its key into memory only.

1. `node scripts/reset-test-data.mjs` prints a read-only inventory and its
   fingerprint. It performs **no deletion**. Review counts and preserve-admin
   scope with the project owner.
2. Only after explicit confirmation, run
   `node scripts/reset-test-data.mjs --execute REVIEWED_FINGERPRINT`.
3. The tool rechecks the inventory, removes reviewed Storage objects, clears app
   rows in a guarded transaction, deletes only the reviewed non-admin users via
   the Auth admin API, and verifies the empty app tables and retained admins.

If any stage fails, it stops. Earlier successful Storage/Auth deletions cannot
be rolled back. Inspect the new read-only preview and obtain a new confirmation
before retrying; never reuse a stale fingerprint. Unknown tables/buckets and a
missing/inactive owner cause a failure before deletion. The SQL transaction also
rechecks account/admin identities and requires empty Storage metadata.

## Phone testing afterwards

Sign out and clear Nearry's **app storage/data** in Android settings (or reinstall)
to remove old sessions, local bookmarks and cached views. Database deletion
cannot remotely erase the phone's local storage. Use real sign-up instead of
Personal/Business demo: demos intentionally contain built-in sample data and are
unaffected by a Supabase reset. Sign in to the dashboard with the preserved admin.

Email delivery/domain setup is unchanged by resetting data.
