# Nearry seven-door security review (closed-beta preflight)

Source: user-supplied educational video highlighting seven failure modes:
client-exposed secrets, disabled RLS, missing per-record ownership,
unprotected admin route, missing sign-up/request limits, unverified
webhook/worker calls, and missing cryptographic signatures.

**Scope:** repository code and automated tests on this branch, not a
penetration test of deployed Supabase or Play Store apps. Do not claim
that production is safe based solely on passing tests.

| Gate | Repository finding / guard | Remaining production task |
| --- | --- | --- |
| Keys on server | React Native reads only \`EXPO_PUBLIC_SUPABASE_URL\` and public anon/publishable key; Geoapify, Resend, service-role and review secrets stay in Edge Functions. Release preflight rejects service role keys. New \`security:check\` CI step checks client source for obvious secret exposure. | Inspect all published environment variables and compiled APK/web bundle for actual secrets; rotate immediately if exposed. |
| RLS enabled | Existing migrations enable RLS and limit client table/column privileges. New database regression asserts RLS on key data/worker tables, including the new private quota table. | Compare actual Supabase production schema and grants against committed migrations. Fix drift with reviewed forward migrations, not by replaying \`run-all.sql\`. |
| Ownership enforced | Existing SQL guards account ownership for joins, bookings, messages, profile fields and media. New quota trigger also refuses mismatched actor IDs and tests cross-user creation. | Exercise two account identities against staging using unmodified and intentionally modified REST requests; confirm no cross-account reads/writes. |
| Admin behind login | Draft PR #20 builds an allowlisted server-verified admin dashboard; it is **not merged or deployed**. Current operator actions use service-role SQL/worker or signed review links. | Deploy and independently audit PR #20; enable strong operator authentication and MFA, rotate/revoke admin access, disable old emailed review links only after transition. |
| Rate limits | Existing place-search usage and report caps. New \`00028_write_abuse_guards.sql\` adds atomic per-account limits on plan creation, offers, messages and join requests even if an attacker modifies the client. | Configure Supabase Auth email OTP/signup limits, bot protection and abuse monitoring in the project dashboard. Per-user quotas do not stop abuse across newly created accounts. |
| Webhooks/worker calls | Existing push, verification email and account-maintenance workers require server-only dispatch headers; place search validates authenticated JWT; review decisions have signed tokens. This branch rejects weak/missing worker/HMAC secrets at startup. | Confirm live deployment uses 32+ byte random secrets; verify scheduler secrets are not in app source; restrict origins and enable secret rotation. No third-party payment webhook exists yet. |
| Cryptographic signatures | Review links are HMAC-SHA256 signed, bound to a specific review job/user/proof with expiry, and have tampering tests. Rejection/approval is a separate POST, never a GET. | On any future payment provider integration, verify the provider signature on the raw event body, record event IDs and process idempotently before crediting a booking. |

## Rate limits introduced by 00028

| Action | Short-window limit | Daily limit |
| --- | --- | --- |
| Create plans | 8 per hour | 30 |
| Publish/create offers | 10 per hour | 40 |
| Send messages | 40 per minute | 1,000 |
| Send new join requests | 20 per minute | 120 |

All counts are per authenticated user, enforced via atomic PostgreSQL
upserts. Triggered write failures roll back quota increments. The
counter table has RLS enabled and is inaccessible from anon/authenticated.
Maintenance removes old counters after 48 hours.

These are conservative starting values, not automatically optimal.
Review telemetry and reasonable customer usage before changing them.
Rate limits are defense in depth, *not* a substitute for real moderation,
provider abuse protection, or correct RLS.

## Staging rollout (not done by this PR)

1. Back up your Supabase database. Check the exact applied migration
   history. Apply only the missing \`00028_write_abuse_guards.sql\` once
   **after** current migrations through 00025. Other open PRs use
   migration identifiers 00026 and 00027; reconcile their deployment
   order and any updates to \`maintenance_retention_cleanup\` before merging.
2. Ensure \`VERIFICATION_DISPATCH_SECRET\`, \`PUSH_DISPATCH_SECRET\`,
   \`ACCOUNT_MAINTENANCE_SECRET\` and \`REVIEW_SECRET\` are unique,
   unpredictable server-side values of at least 32 bytes. The updated
   workers intentionally refuse weak values. Change secrets on the
   scheduler and function configuration together.
3. Deploy the updated Edge Functions from this branch to staging:
   \`send-push\`, \`account-maintenance\`, \`notify-verification\`, and
   \`review-verification\`. Verify unauthorized POSTs fail and authorized
   scheduled requests complete. Keep service-role credentials server-only.
4. In the Supabase dashboard, review Auth rate limits for email OTP,
   sign-up and token verification. Turn on available bot-abuse controls
   for your deployment. This is a **manual configuration requirement**
   and cannot be verified from GitHub.
5. Test two normal accounts and one business in staging. Confirm:
   role ownership, RLS across accounts, blocked interactions,
   booking/join capacities, rate-limit errors and subsequent retries,
   report moderation, deletion, private proof URL expiry and push worker
   authentication. Test in different sessions and on real devices.
6. Run \`npm run security:check\`, \`npm run sql:check\`,
   \`npm run typecheck\`, \`npm test\` and
   \`npm run test:database\` (prefer disposable PostGIS in CI).
7. Audit the **actual deployed** RLS policies, service-role permissions,
   client bundle, storage bucket visibility and admin endpoint. A
   public \`sb_publishable_...\` or \`anon\` key in the client is expected;
   a service-role key is never acceptable.

## Scope limitations

This PR does **not** turn on production RLS, deploy the migration, rotate
secrets, configure provider limits, install a WAF, deploy an admin site
or conduct an external security assessment. It does not add a billing
webhook because Nearry currently has no payment processing integration.
It also does not remove historical emails/links before a verified
moderation workflow is active.
