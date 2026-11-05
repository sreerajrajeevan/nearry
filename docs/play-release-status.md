# Google Play release status — 4 November 2026

**Not ready for public production submission.** This is the observed release
state, not a certification that all phone journeys or Play declarations passed.

## Completed in this release audit

- Confirmed main includes the email OTP fix: Supabase's eight-digit codes are no
  longer cut to six. Current source accepts full 6–10 digit numeric codes.
- Checked live schema: account reporting, blocking and deletion-request tables
  and RPCs are present with row-level security. Business proof storage is private;
  avatars/post photos are intentionally public.
- Applied the missing, already-merged **00025** notification migration after
  checking for partial-install conflicts and privately saving the affected
  function definitions. Notification preferences and push receipts now exist.
- Backed up the deployed push function and cron definitions privately, deployed
  the current `send-push` worker, and deployed `account-maintenance`. Both returned
  **401** for unauthenticated POSTs; no dispatch secret was sent in that test.
- Identified the failing push scheduler's missing `pg_net` dependency, paused
  that schedule and enabled the extension. Its existing dispatch header matches
  the configured worker secret; secret values were not printed or committed.
- Installed the missing `close-expired-posts` cron job, every minute, and observed
  successful runs. The existing booking-hold expiry job remains active.
- Added an in-app child-safety standards page, linked before login and under
  Safety & privacy for both account types. Reuses the existing private `safety`
  report category; no report-table migration is required.
- Extended policy exports with a public child-safety page and support index;
  refused missing/placeholder contacts and tested HTML escaping and page links.
- Prepared listing copy, a Data safety inventory, Play icon/feature artwork and a
  manual workflow for packaging the files. No store declarations were submitted.

The live changes above are separate from merging the UI/export changes. Private
rollback snapshots are in ignored `.release-private/`, excluded from EAS upload;
they are scoped function/scheduler backups, not a complete database backup.

## Still blocks public release

| Item | What remains |
| --- | --- |
| Email delivery | Last live mail audit found Resend's test sender rejecting non-owner recipients. Verify a sending domain and update SMTP From; retest both signup and returning login on a phone. The October signup template was corrected to include a code. |
| Operator/support | Owner must supply the real legal operator and monitored support/child-safety contact. Local production preflight still rejects missing values; do not publish preview placeholders. |
| Public policy URLs | Export reviewed pages and host privacy, deletion and child-safety pages on public HTTPS URLs. A purchased domain is not necessary for hosting these pages, but Resend separately requires a verified sending domain for its normal sender. |
| Deletion activation | The worker is deployed but has no maintenance dispatch secret/schedule. A requested deletion is waiting. Obtain explicit approval before activating permanent cleanup, then verify file-before-Auth deletion with controlled accounts. |
| Push activation | Push dispatch is deliberately paused; a backlog is waiting. Complete FCM credentials for the correct Expo project and test a phone before resuming delivery. Receipts and scheduler success do not prove device delivery. |
| Business review | The review-email worker's required dispatch secret, allowed From address and schedule were not present in the inspected configuration. Configure them and test a proof submission/review before claiming Business publishing is ready. |
| Expo production | CLI is signed out. Recheck the existing `sreerajsrees-team/nearry` production environment and set matching backend, operator and support values. Reuse EAS project `a220a973-0d77-4c81-ba3a-5df4bba83ce5`; Firebase client project is `nearry-43e80`. |
| Android signing | Confirm whether `com.nearry.app` has ever been uploaded to Play. Reuse its existing upload key if so; otherwise create/back up a private key after owner approval. The debug APK is not a store release. |
| Signed build | Build the production AAB, upload to internal testing and install the Play-signed app. Check the display version and remote Android version code against Play's existing history. |
| Store setup | Complete actual developer/account verification, support details, store listing, screenshots, App access, Data safety, ads, audience, content rating and applicable child-safety declarations. |
| Reviewer access | Supply a reliable way for reviewers to reach all restricted Personal/Business functionality. An expired OTP or sample-only demo does not establish full access. |
| Phone checks | Test Google/OTP login, restart/session restore, photos, location denial, join/approve/leave, business approval/bookings, chat, reports/blocks, notification taps, deletion cleanup and 16 KB runtime compatibility. Record results; do not mark unperformed tests passed. |
| Closed testing | If Play classifies this as a newer personal developer account, its production gate requires at least 12 testers opted in continuously for 14 days, followed by a production-access application. Verify the account's own dashboard. |

The configured Android target is API 36, meeting the currently published new-app
target requirement. Build checks and actual Play review are separate.

## Packaging

`Prepare Play listing files` is a manual GitHub workflow. It creates an artifact,
not a public website or Play release. Enable its policy option only after setting
reviewed repository variables `EXPO_PUBLIC_LEGAL_OWNER` and
`EXPO_PUBLIC_SUPPORT_EMAIL`. Locally, run the store-art generator and
`npm run legal:export` with the same reviewed contact values.

References: [Android target requirement](https://support.google.com/googleplay/android-developer/answer/11926878),
[new personal-account testing](https://support.google.com/googleplay/android-developer/answer/14151465),
[required app content](https://support.google.com/googleplay/android-developer/answer/9859455),
[account deletion](https://support.google.com/googleplay/android-developer/answer/13327111),
[child safety](https://support.google.com/googleplay/android-developer/answer/14747720).
