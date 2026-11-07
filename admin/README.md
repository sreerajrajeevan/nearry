# Nearry operations dashboard

Business verification, reported-content review, account/plan/offer/booking lists,
read-only worker queues and an audited decision history. The dashboard follows
Nearry's Forest & Sand theme and works on desktop and phone browsers.

## Access

Sign in with an **existing, confirmed Nearry email account**, then complete a
TOTP authenticator check. First use offers a QR code/setup key; subsequent sign-ins
use the existing authenticator. Store the authenticator safely. A successful email
login alone never grants admin access. The allowlist is keyed to the confirmed
Auth UUID, not an editable profile/email label. There is no public admin signup.

The Edge API checks the actual Supabase Auth user, active private admin membership,
active account and `aal2` session for every private data read or decision. Only
allowlisted users can reach authenticator setup in this interface. Suspension,
account deletion or allowlist revocation prevents access. Owner and moderator
roles exist; only owners may suspend reported accounts. There is no client-side
service key, unrestricted chat access, arbitrary account deletion or proof export.

## Setup / migration

1. Existing projects through 00028 apply **only**
   `supabase/migrations/00029_admin_console.sql`. The former unmerged 00027 admin
   draft was renumbered to avoid the now-merged participation migration. Never
   replay `run-all.sql` on an existing project.
2. In a trusted database session, match the intended email to exactly one
   confirmed active Auth user. Insert that **verified UUID** into
   `admin_console_members(user_id,role)` with role `owner` or `moderator`.
   Do not put privileged access in user metadata or grant the browser access
   to that table. Provisioning the requested operator is a separate live action,
   not a hardcoded email in the migration. Revoke with `revoked_at=now()`.
3. Enable Supabase Auth TOTP enrollment and verification. The application never
   weakens MFA to work around a configuration error. The account owner completes
   their own enrollment; do not ask them to share email/authenticator codes.
4. Set the exact hosted HTTPS origin in the Edge secret `ADMIN_ALLOWED_ORIGINS`.
   Deploy only `admin-console`, with `--no-verify-jwt`: the handler performs its
   own Supabase Auth validation and private authorization on every request.
   Keep all other existing workers/schedules unchanged.
5. `npm ci`, then `npm run admin:build`. The build reads the existing public
   `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`, bundles the
   lockfile-pinned Supabase SDK locally, and emits `dist-admin/`. It rejects
   service-role/private keys. No runtime JavaScript CDN is used. The public key
   belongs in the generated config; server credentials never do.
6. Host that output over HTTPS. The build includes a restrictive CSP, no-store,
   no-referrer and frame protection headers; `index.html` also carries CSP for
   static hosts. Do not upload `.env`, `.release-private` or the repository as a
   public document directory. The created Sites deployment remains owner-private
   in addition to Supabase admin authorization.

## Review workflow

Business reviews show the current pending submission, category, area and owner.
Open the review, load its private proof, inspect it, and explicitly confirm review
before approval. The preview URL lasts 60 seconds and can be reloaded. Rejection
requires a reason, which is delivered to the business. Current pending proofs
remain reviewable by an MFA-authenticated administrator even if their old emailed
review link expired. Emailed links retain their original seven-day expiry.
Changed/replaced documents and already completed decisions are rejected.

Approval/rejection, business notification and admin audit row are one database
transaction. The membership row is locked during the decision, so a concurrent
revocation cannot silently bypass authorization. Pending requests are filtered
in SQL before pagination. Overview counts use the same current-request criteria.

Reports show the complete submitted evidence, with confirmation and a reason for
removal/suspension. Account/conversation reports offer dismissal or owner-only
account suspension; deleting a specific message needs a message report. This does
not introduce general browsing of private chats. Refresh updates the queue; returning
to the browser refreshes it too. Overlapping section loads cannot display stale
rows under another section's actions. Sign-out clears proof URLs and evidence.

Keep the current verification-email worker in place during cutover. Once the
operator has signed in and verified the dashboard, retire email delivery separately
if desired; do not remove the submission trigger or review queue.

## Validation

Automated handler tests cover missing/invalid sessions, unconfirmed/inactive users,
revoked membership, MFA, role restrictions, pagination, private proof boundaries,
reason validation and safe errors. Database tests cover old requests, stale proofs,
atomic notifications/audit, duplicate decisions and client RPC denial. Browser QA
uses fabricated sessions and documents, including 320/390-pixel layouts, proof
preview, approval, report evidence, sign-out and authenticator enrollment. Actual
operator email delivery and authenticator enrollment require the owner's first
sign-in; QA does not impersonate that account or approve real businesses.
