# Account safety, privacy and notification rollout

This change contains application and server code. It does not modify the deployed Supabase project, create a scheduler, send real notifications, delete real accounts or publish legal pages automatically.

## Deployment order — existing project at migration 00023

1. Review and apply **only** `00024_account_safety.sql`, then `00025_push_delivery_receipts.sql`. Back up the project first. Do not use `run-all.sql` on an existing project.
2. Fill the public build configuration in `.env`/build secrets:
   - `EXPO_PUBLIC_EAS_PROJECT_ID`: the Expo project's UUID. This is public, not an access token.
   - `EXPO_PUBLIC_LEGAL_OWNER`: the actual legal operator/company name.
   - `EXPO_PUBLIC_SUPPORT_EMAIL`: a monitored public support address.
3. Set a separate server-only `ACCOUNT_MAINTENANCE_SECRET`. Retain `PUSH_DISPATCH_SECRET`. If Expo enhanced push security is enabled, set server-only `EXPO_ACCESS_TOKEN` as well. Never put these secrets or the Supabase service-role key into an `EXPO_PUBLIC_*` value.
4. Deploy the updated workers:

   ```sh
   supabase functions deploy send-push --no-verify-jwt
   supabase functions deploy account-maintenance --no-verify-jwt
   ```

   These endpoints authenticate **every** request using the required `x-dispatch-secret` header. Disabling gateway JWT checks does not make them public worker APIs.
5. Configure trusted POST schedules: `send-push` every minute with `PUSH_DISPATCH_SECRET`; `account-maintenance` every minute or every five minutes with `ACCOUNT_MAINTENANCE_SECRET`. Store headers in the scheduler's secret store. Alert on failed HTTP calls and the backlog queries below.
6. Build the app after setting public variables. The notifications plugin changes native configuration, so rebuild the APK/AAB/iOS application. Configure FCM/APNs credentials for the matching Expo project. Expo Go/browser tests do not prove device delivery.
7. Run `npm run legal:export`, review `dist-legal/privacy.html`, `terms.html` and `delete-account.html`, and host them at stable public HTTPS URLs. Use those URLs in the stores' privacy/deletion fields. The exporter refuses blank owner/contact configuration. The app offers the same policy text before login and in both account experiences. Missing legal configuration also prevents accepting preview terms in a real account. **Do not release before reviewing the operator details, 18+ audience, providers, public-photo visibility and retention statements against the actual deployment.**
8. Test with disposable staging accounts before rollout. Existing users are asked to confirm they are 18+ and accept policy version `2026-10-19` before entering the app. This is self-declaration, not verified identity/age. Update `POLICY_VERSION`, the accepted version in the migration/RPC and policy dates together for material changes. Account deletion remains accessible without accepting new terms.

## Reporting and blocking

Report is available on post/offer/venue details, a received message (hold the bubble), and the conversation's other account. Open a post photo full-screen to report that image. Reports resolve the target owner and snapshot on the server; the app cannot forge the owner. Each reporter/target pair has one report, and at most 20 new reports may be submitted per day. Only the reporter can read their limited status fields; evidence and reviewer notes are not available to clients.

Blocking works in both directions for new messages, conversations, join requests, approvals, reservations and confirmations. Database triggers enforce this even through existing security-definer RPCs or direct message writes. Blocked plans and businesses are excluded from discovery and blocked chat pairs from the inbox/badges. Existing bookings remain readable and cancellable through history; blocking alone does not cancel them. Your own blocks can be removed in Safety & privacy → Blocked people. A person cannot unblock a block imposed by the other account.

### Review reports as a trusted operator

Use the Supabase SQL editor as an authorised project operator, or an authenticated server with the service-role key. There is no client moderator role or public admin API.

```sql
select id, target_kind, target_id, reason, details, snapshot, created_at
from public.content_reports where status='open'
order by created_at limit 50;

-- Replace with a reviewed report UUID. Never automate decisions from this example.
select public.review_content_report('REPORT_UUID', 'dismiss', 'Reviewed; no violation found');
select public.review_content_report('REPORT_UUID', 'remove', 'Removed under community guidelines');
select public.review_content_report('REPORT_UUID', 'suspend', 'Account suspended after review');
```

Choose **one** action per report. Removal hides the target, cancels a removed post or offer's future commitments, deletes a removed message, or queues the owned photo object for Storage API cleanup. Public caches may retain an image until expiry. Suspension cancels commitments and disables new activity, while allowing the owner to request deletion. Unclaimed public venues can be reported for removal but have no user to suspend. Reinstatement/appeals are handled by the operator; document the decision before clearing `profiles.suspended_at` in the trusted console. Reports are manually reviewed; no automatic photo classifier or comprehensive content-filtering service is included.

## Account deletion

The owner types DELETE and submits an authenticated, idempotent request. Their profile is immediately marked inactive; new uploads/interactions are rejected. Plans and offers are cancelled, future bookings cancelled, participation withdrawn and push tokens removed. Existing sessions see a restricted account screen. This request cannot be undone from the app.

`account-maintenance` leases up to ten jobs, removes storage objects in bounded batches from every bucket under that user's folder, verifies that no files remain, unlinks venue ownership, removes report evidence involving the user and related notification copies, and then calls Supabase Auth Admin delete. Auth cascades remove related profiles, posts/photos, offers/slots/bookings and shared conversations/messages. Public venue listings remain, without the account association or its gallery. Partial storage failures retain the inactive account and job for retry; Auth is never removed before file cleanup. Completed jobs are removed. A lost Auth acknowledgement is safe to retry. Large accounts resume across runs; jobs stop automatic retries at 20 claims and require operator attention.

For a deletion request received through the public support page, verify the registered owner using a trusted support process **without requesting passwords or sign-in codes by email**. A service operator may then queue the same workflow:

```sql
select public.queue_account_deletion('VERIFIED_OWNER_UUID');
```

This function is unavailable to app clients. Never infer ownership from an unverified sender, a posted user ID or a report. The static support page is a request channel, not automatic email-triggered deletion. Keep the mailbox monitored. Handle any access/correction or legally necessary retention exception separately and explain it to the requester. Caches/backups expire under provider settings; confirm backup rotation and deletion-aware restoration procedures in the actual project.

## Notifications

Push preferences affect remote delivery, not the in-app notification center. Disabled users' unsent backlog is discarded, and notification creation checks preferences. Registration uses the explicit Expo project ID, is serialized with sign-out removal, and rechecks the signed-in account. A blocked or inactive account cannot register a token. Returning from phone settings retries registration when permission is granted.

The worker sends generic lock-screen text and an opaque notification ID, not chat bodies. Taps fetch the actual notification under recipient RLS before navigating; payloads cannot choose arbitrary routes or URLs. Cold-start/resume handling waits for navigation readiness. Realtime refreshes the in-app view but does not create a second local banner.

Accepted Expo tickets are stored per job/device, so a failed second device does not resend to the first device on retry. Receipts are checked after approximately 15 minutes. Invalid tokens are removed only when their registration timestamp has not advanced, protecting reassigned installations. Missing receipts retry until 24 hours; permanent receipt failures remain visible for an operator. Delivery is still at least once: a timeout after Expo accepts a request but before the ticket is saved may duplicate an alert. An accepted ticket or receipt is not proof a person saw it. Already queued phone alerts cannot be recalled when preferences change.

## Monitoring and retention

```sql
select user_id, requested_at, attempts, next_attempt_at, last_error from account_deletion_jobs order by requested_at;
select id, attempts, next_attempt_at, last_error from media_cleanup_jobs order by next_attempt_at;
select id, attempts, next_attempt_at, last_error from push_jobs where sent_at is null order by next_attempt_at;
select id, status, receipt_attempts, last_error from push_deliveries where status='failed' or (status='ticket' and created_at<now()-interval '1 hour');
select count(*) from content_reports where status='open';
```

Alert on old/exhausted deletion/media jobs, exhausted push attempts, credential/receipt failures and unreviewed reports. Investigate before resetting attempts. The maintenance schedule removes resolved reports after 90 days and push delivery records/jobs after 30 days. Open reports remain until reviewed or the related account is deleted. No production schedule is created by CI.

## Validation and remaining live checks

- Automated database tests: private reports, deduplication, moderator-only access, mutual blocking across real join/chat/booking writes, manageable history, deactivation, blocked uploads/token registration, file-before-Auth deletion, consent metadata and muted push queues.
- Worker boundary tests: dispatch-secret protection, Storage failure retry, file-before-Auth order, accepted-device retry preservation, generic payloads and receipt token reassignment protection. These use fakes, not live accounts/devices.
- Browser demo: report, report status, block → hidden plan → unblock, settings and preference switch. Demo safety state is session-only; deletion is disabled.
- Staging phones: complete both account types; check consent/deletion without agreement, report a real photo/message, block in each direction across two accounts, cancel an existing booking after blocking, mute/re-enable notifications, denied permission, cold-start/deep-link handling and sign-out/account switching. Confirm actual FCM/APNs receipt delivery.
- Request deletion using a **disposable** Personal account and a Business account with sample photos, future bookings, a venue and chat. Wait for the worker, verify Storage/Auth/database removal and cancellation notices, then simulate a worker outage and confirm recovery. Do not run destructive checks on a real user's account.
