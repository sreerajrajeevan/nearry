# Nearry admin console

A separate, responsive web dashboard for Nearry operations and moderation.

**Not for consumer accounts.** The browser uses only a public Supabase
publishable key and an authenticated user token; service role stays inside
\`supabase/functions/admin-console\`. Requests require server allowlisting.

## Screens and permissions

| Screen | Scope |
| --- | --- |
| Overview | Counts of members, plans, offers, bookings, open reports, pending business reviews |
| Business reviews | Pending documents, private 60-second proof links, approve/reject |
| Safety reports | Reported evidence only; dismiss, remove, or owner-only suspend |
| Accounts | Account type, status, verification, registration date |
| Plans | Basic activity details and author IDs |
| Offers | Local promotion details and business IDs |
| Bookings | Reservation state and customer/offer IDs |
| Operations | Deletion jobs, media cleanup, pending push jobs |
| Audit trail | Moderator action, actor ID, target ID, timestamp and reason |

The dashboard intentionally does **not** provide unrestricted chat history,
user-email exports, arbitrary account deletion, or client-side access to
private business proof Storage objects.

## Staging installation

1. Back up staging, then apply only the unapplied forward migration
   \`supabase/migrations/00027_admin_console.sql\` after 00025.
   The separate selfie-review PR uses 00026; it is not required here.
   Never use \`run-all.sql\` against an existing Supabase project.
2. Sign up or sign in as your existing Nearry identity (Google/email).
   Confirm the correct user UUID in Supabase Auth **as a trusted operator**.
   In the SQL editor, explicitly allowlist it:

   \`\`\`sql
   insert into public.admin_console_members(user_id,role)
   values ('YOUR_CONFIRMED_AUTH_USER_UUID','owner');
   \`\`\`

   Roles: \`owner\` or \`moderator\`. Only an owner can suspend users from
   the web UI. Revoke access via \`revoked_at=now()\` in SQL.
3. Configure the exact HTTPS admin website origin(s) in Supabase Edge secrets:

   \`\`\`sh
   supabase secrets set ADMIN_ALLOWED_ORIGINS=https://admin.example.com
   supabase functions deploy admin-console --no-verify-jwt
   \`\`\`

   The function deliberately validates user JWTs via Supabase Auth and
   checks the private allowlist for **every** request. Gateway JWT checking
   is disabled only to allow its own explicit validation; it is not public.
4. Host the \`admin/\` directory as a static site over HTTPS (e.g. a
   separate Cloudflare Pages project). Copy \`config.example.js\` to
   \`config.js\` in the hosted build. Set the exact \`supabaseUrl\` and
   **public anon/publishable key**. Do not add any service-role/secret
   key, OAuth client secret or server worker secret to this file.
   \`config.js\` is ignored by Git.
5. Add the admin website URL to the Supabase Auth redirect allowlist.
   Make sure the Google login provider works for the admin's account,
   or enable numeric email OTP template delivery with an SMTP sender.
   Login does not allow self-registration through the admin site.
6. Test that a regular member receives 403 on every admin operation.
   Verify pending proof review, stale proof rejection, duplicate decisions,
   audit logging, report removal/suspension, and operations queue display.
   Validate desktop and mobile browser layouts and sign-out.

**Production security:** use an isolated, trusted admin identity with
multi-factor authentication, strong host security headers/CSP, and limited
access to the site. This first version uses the existing Supabase identity
and does not enforce an MFA assurance level in its code; restrict deployment
until your admin sign-in security is adequate. Use a reviewed pinned/bundled
Supabase JS dependency rather than a third-party CDN for a hardened launch.

## Replace verification emails safely

The current verification submission still queues jobs in
\`verification_review_jobs\`. The admin UI reads that same queue and calls
the existing atomic approval/rejection function, so no re-upload is needed.

During transition, keep emailed links working. Once the dashboard is deployed,
tested, and actively staffed, disable the \`notify-verification\` scheduler.
**Do not remove** the database verification trigger or review queue.
Outstanding email links can expire naturally; retire the email-only
function in a separate release. No automatic dashboard reminders are built,
so check pending business reviews and reports every day.

## Safety and operations

- API access is denied unless user JWT and private admin membership pass.
- Only server-side service-role code fetches other users' operational records.
- Only approved business review jobs get short-lived private proof URLs.
- Moderation decisions and audit writes share a database transaction.
- Account suspensions happen through the existing reported-content workflow.
- The app does not read raw private chat, except snapshots associated with
  user-submitted reports.
- Admin panel only presents server metadata; live files and user records are
  not copied into the repository.
- Existing account deletion and message privacy controls remain intact.

This repository change has **not** deployed a function or created an actual
admin user. There is no live admin URL until you complete these steps.
