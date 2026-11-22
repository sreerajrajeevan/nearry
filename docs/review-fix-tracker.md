# November 18 test-report fixes

Branch: `fix/review-reliability-and-scale`, based on main `a79c1fd`.
No live database, accounts, schedules, credentials or deployed builds are changed by this PR.

## Implemented

| Area | Result |
| --- | --- |
| Auth | Network failure no longer vetoes sign-out. Push cleanup is bounded, retains encrypted retry metadata and has a token-specific revocation capability. Old registrations invalidate old capabilities. Native sessions migrate from AsyncStorage to chunked SecureStore; failed writes preserve the last committed session. |
| Onboarding | Business Back preserves its draft. Successful autosaves clear temporary errors. Pending OAuth role hints expire. Trusted native callback slash variants work. Email resend cooldown survives screen remounts. |
| Network and data | Backend reads/writes, uploads and GPS have deadlines. Background refresh errors retain the last good data. New account/filter keys cannot display a previous scope's loaded data. |
| Discovery | Indexed spatial lookup and filter-aware cursor pages bound plan/offer responses to 80, normally 30. Card aggregates are computed after limiting candidates. Home widens radius through bounded server queries; Search filters offers on the server. Home, Search, My Posts, host plans and offer lists expose more results. Calendar filters are sent before the page bound. |
| Bookings and Activity | Supporting indexes; owner-only booking counts replace the unused redemptions display. Business Bookings defaults to upcoming and uses a paged FlatList. Activity uses paged own requests, bookings and a single host-request query instead of one query per post. Dashboard totals are independent of its bounded preview. |
| Notifications | One unread provider per account, grouped chat notices, a separate Updates filter, older notice pages, larger independent controls. Chat push jobs coalesce, actionable updates have priority, and each invocation drains bounded batches with retries. Foreground banners/sound are suppressed for the focused chat. Existing sender/message previews remain intentional. |
| Chat | Direct history has older pages and retry keys; cleared history cannot reappear from an older page. Visible messages drive direct read acknowledgement. Group subscriptions target their own post; reading older group history does not acknowledge a new bottom snapshot. Inbox tab/search stay on return and reset between accounts. |
| Plans and offers | Required meeting places survive edit validation in UI/service/DB. Today picks a future default. Expired request deadlines do not block unrelated edits. Saved plans hide unavailable entries. Shared links survive sign-in/onboarding. Numeric/capacity validation, distinct court/service names, friendly overlap errors, ended badges, venue retries and picker cancellation are corrected. |
| Images | Existing post covers were already cropped to 1600px; the report's five full-resolution post uploads were not reproducible. All public photo upload callers now normalize JPEGs, generate 640px companion previews and use originals for gallery viewing. Legacy URLs work. Direct post/venue attachments enforce ownership, canonical project origin, caps and serialized parent writes. Removed owned photos and their previews enter the cleanup queue; reattachment before a cleanup lease wins. |
| Admin | Email review URLs are dashboard handoffs only; they cannot read proofs or approve accounts. Existing dashboard allowlist/MFA remains required. Account/proof reads are audited before returning data; proof frames are sandboxed. Inactive accounts cannot use place endpoints. |
| Operations | Obsolete schema.sql removed. Fresh-install guidance uses the generated migration bundle; applied history is not rewritten. Idempotent maintenance setup preserves equivalent existing schedules; read-only checks report backlog/failures without exposing secrets. Public-release preflight requires share/crash-reporting configuration and verified-sender attestation when email OTP is enabled. Screen-level boundaries and scrubbed, rate-limited backend error categories supplement the root boundary. |

## Validation and limits

Run `npm run sql:check`, `npm run typecheck`, `npm test`, the admin build and Android/web exports. The local PGlite suite skips PostGIS-specific cases; CI additionally applies every migration unchanged to disposable PostgreSQL 16 + PostGIS and runs real separate-connection race tests plus the 10,000-plan bounded-page test. CI also compiles unsigned Android APK/AAB and checks manifest/signature/16 KB library alignment.

The report's supporting load scripts and hardware were not supplied. Its latency numbers are not claimed as reproduced, and a disposable database result is not a production capacity guarantee.

Before distribution, verify on physical phones: SecureStore migration and flaky-network sign-out, weak GPS, large image upload/crop, Android keyboard/composer visibility, push background delivery/receipt/taps, and the two-phone join/approve/leave flow. Browser checks cannot replace those.

## Rollout after merge

1. Apply only unapplied forward files: `00050_review_reliability.sql`, `00052_discovery_pagination.sql`, `00053_media_write_safety.sql`, `00054_activity_pages.sql`. 00051 belongs to the independent bundle feature and is not a dependency. Do not replay applied migrations or run run-all.sql on an existing project.
2. Redeploy `send-push`, `account-maintenance`, `place-search`, `place-autocomplete`, `admin-console`, `notify-verification`, `review-verification`. Build/rehost the admin dashboard. Set the HTTPS `ADMIN_CONSOLE_URL` worker secret to that dashboard.
3. Check existing maintenance schedules with `supabase/ops/verify-maintenance.sql`. Review `setup-maintenance.sql` only if setup is missing; its Vault names and worker secrets must match. It does not replace existing inactive/broken schedules automatically.
4. Build a new native app with SecureStore included. This dependency change cannot be delivered as an OTA-only update.
5. Before a public release, configure and verify the sender domain if enabling OTP, the share landing URL and the Sentry DSN, then run the public-release preflight. No domain or email-delivery capability is provisioned by this PR.

Product choices intentionally preserved: verified businesses may opt into Spotlight; sender/message notification previews remain visible; cancelled-booking chat access, waitlists, recurrence and paid placement are outside this bug fix.
