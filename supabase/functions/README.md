# Server workers and business review

Apply migrations through `00018` before deploying these functions. These are server processes; their secrets must never be included in Expo environment variables or app code.

## Configuration

Hosted Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to functions. Set these additional secrets in the Supabase dashboard or CLI:

| Secret                         | Used by                     | Value                                                                                |
| ------------------------------ | --------------------------- | ------------------------------------------------------------------------------------ |
| `PUSH_DISPATCH_SECRET`         | send-push                   | Random server-only dispatch secret                                                   |
| `VERIFICATION_DISPATCH_SECRET` | notify-verification         | A separate random dispatch secret                                                    |
| `REVIEW_SECRET`                | both verification functions | Strong random signing secret (at least 32 bytes)                                     |
| `RESEND_API_KEY`               | notify-verification         | Resend email API key                                                                 |
| `ADMIN_EMAIL`                  | notify-verification         | The reviewer recipient                                                               |
| `VERIFICATION_FROM_EMAIL`      | notify-verification         | A sender allowed by your Resend account, e.g. `Nearry <review@your-verified-domain>` |

Deploy from the project root:

```sh
supabase functions deploy send-push --no-verify-jwt
supabase functions deploy notify-verification --no-verify-jwt
supabase functions deploy review-verification --no-verify-jwt
```

JWT verification is disabled because schedulers and emailed links do not carry a user's JWT. The two workers require their exact `x-dispatch-secret` header. The review endpoint requires a signed, expiring token tied to a private review job and document. Do not disable these application checks.

## Scheduler

Configure a trusted scheduler to POST every minute to:

- `<SUPABASE_URL>/functions/v1/send-push` with `x-dispatch-secret: <PUSH_DISPATCH_SECRET>`.
- `<SUPABASE_URL>/functions/v1/notify-verification` with `x-dispatch-secret: <VERIFICATION_DISPATCH_SECRET>`.

Store headers in the scheduler's secret store. Neither endpoint accepts client-supplied recipients or proof paths. Separately run `close_expired_posts()` and `expire_booking_holds()` every minute with a trusted service role. This repository does not enable or change production schedules automatically.

The verification worker claims at most 10 jobs per run, leases for five minutes, and retries up to eight claims within seven days. Inspect `verification_review_jobs.last_error`, `attempts`, and `sent_at` when mail fails; exhausted or expired jobs require operator attention. Investigate the error before manually resetting attempts/next_attempt_at. Email delivery is at least once: if sending succeeds but saving the acknowledgement fails, a later retry may send the same review link again. A decision itself is single-use and atomic.

## Review lifecycle

1. Owner uploads a JPEG, PNG, or WebP image to private `verification_docs`, then calls `submit_verification`.
2. The transaction queues a private review job. No HTTP call or `pg_net` extension is needed; a mail outage does not undo submission.
3. Worker emails a link, without copying the private proof into an attachment. The review page creates a five-minute document URL.
4. GET only displays the review. An explicit form POST calls the service-only `review_verification` RPC, which changes status and creates the in-app notification in one transaction.
5. Replays, expired links, and superseded submissions are rejected. Old tokens from the pre-`00018` email function are deliberately invalid. Pending submissions are backfilled for new delivery on upgrade.

Rotate `REVIEW_SECRET` to invalidate emailed links if necessary. Access to a valid review link grants approval authority; keep the review mailbox private. An administrator still associates a reviewed venue with `venues.business_id`; newly created offers inherit the business's first associated venue, or accept another venue owned by that business. The email review does not claim arbitrary venues.

## Release verification

Use a staging Supabase project and test mailbox first. Confirm unauthorized worker POSTs return 401, a pending upload queues one job, opening a review link changes nothing, approval/rejection notifies the owner once, a rejection can be resubmitted, and an old link cannot decide the new proof. Verify the actual mail sender, Storage access, Realtime, and device push separately. Automated tests do not send email or push, and do not modify a deployed project.

## Place suggestions

The authenticated `place-search` function is configured separately from scheduled workers. It uses `GEOAPIFY_API_KEY` (server only) and migration `00019`; no dispatch secret or scheduler is needed. See [place search setup](../../docs/place-search.md) for deployment, quota controls and the provider adapter contract.
