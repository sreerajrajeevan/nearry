# Optional personal selfie check (migration 00030)

A trusted person compares a private selfie with the submitted public profile
photo. The badge says **Selfie checked**. It does not establish legal identity,
age, uniqueness or live-person presence. No face recognition or face templates
are used. Browsing, posting and joining remain available without this check.

## Setup

1. Back up the existing database and apply **only missing migrations**, through
   `00030_personal_selfie_verification.sql`. Migration 00029 (admin console) is a
   prerequisite. Never rerun `run-all.sql` on an existing project.
2. Deploy `admin-console` with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and
   the existing exact `ADMIN_ALLOWED_ORIGINS`. Rebuild/deploy `admin/` to the
   existing private dashboard. Keep the service-role key on the server.
3. Build a fresh mobile binary. Camera permission is intentional for this
   optional, front-camera flow. Microphone, broad library access and background
   location remain excluded. A JavaScript-only update cannot add native camera
   permission. Profile photo uploads now use unique paths for comparison. Older builds can
   still update legacy `avatar.jpg` photos; those photos must be uploaded again
   in the new version before requesting a check.
4. Confirm `selfie_proofs` is private (5 MB JPEG/PNG/WebP only) and the existing
   `account-maintenance` schedule runs. The worker deletes objects through the
   Storage API; never delete live `storage.objects` rows manually.
5. Keep a reviewer available and check the cleanup backlog. Update the Play
   Data safety declaration to include optional photo collection for this flow
   before distributing the new release. Review the in-app privacy/consent copy.

## Reviewing in the dashboard

Open **Selfie reviews → Compare photos → Load comparison photos**. The left image
is the public profile photo bound to the submission; the right is the private
selfie. Both must load. Compare them yourself, then confirm the checkbox and
choose **Mark selfie checked**. If unclear or inconsistent, choose **Ask for
another selfie** and give a short, useful reason. Do not put private image links,
identifying facial descriptions or credentials in notes. Do not treat this as
certified liveness or an ID check.

Every request requires a confirmed active administrator, current allowlist
membership and MFA (`aal2`). Both owners and moderators can review selfies.
Decisions and an audit entry commit together; the applicant receives an in-app
notification that opens their status screen. Proof links expire after 60 seconds.
Do not approve or reject real requests as a deployment test.

## Storage, consent and retention

- Profile → Selfie verification shows current status, reason and camera action.
  A complete personal profile and an uploaded Nearry profile photo are required.
- Consent is unchecked initially and resets on retake. Gallery input is not part
  of the selfie UI; modified clients can still upload other images. Human review
  remains necessary and this is not a certified liveness system.
- Clients can read their own status/note but cannot change verdicts or read
  another person's proof or review details. Other members get one boolean.
- A submission has a unique ID. Decisions for a cancelled or superseded ID fail.
  Uploads and review are bound to an existing owned avatar object, not an
  arbitrary remote image URL. The admin server validates the project's origin.
- Overwrites of private selfies and new immutable avatar paths are denied. Pending selfies and compared avatars
  cannot be deleted and reinserted to swap the bytes under a review. Changing
  the profile photo revokes pending/approved status and queues the old image.
- Approval, rejection, cancellation and avatar changes queue the private selfie
  for deletion. Undecided reviews expire after seven days; abandoned uploads are
  queued after 24 hours. Actual removal occurs on the existing maintenance run,
  with retries after a storage failure. Monitor Operations for failures.
- The owner can cancel pending review or remove their check. The minimal result,
  consent time, submission ID and moderator audit remain until account deletion;
  the private photo is not retained after review. Review notes are owner-only.
- Account deletion includes this bucket via the existing generic storage scan
  before deleting the sign-in account. No deletion schedule is changed here.
- Submissions have a two-minute cooldown and a five-per-UTC-day limit. At most
  two outstanding uploads per owner are admitted by the normal storage policy;
  concurrent uploads are not a strict quota. General write abuse protections
  are a separate release concern.

## Validation

Automated tests apply the real migrations to a disposable database and exercise
private file access, consent, current-avatar binding, stale submission decisions,
atomic approval/notification/audit, rejection, cancellation, avatar invalidation,
seven-day expiry, abandoned uploads and account-deletion inclusion. Handler tests
cover MFA and unsafe/changed comparison URLs; service tests cover actual
supabase-js serialization, JPEG bytes, private upload and failure cleanup.

Before release, install a fresh Android build on real phones: allow/deny camera,
retake/cancel, submit with deliberate consent, check pending status, manually
approve/reject a **test account**, open the notification, change the avatar,
remove the check and confirm Storage cleanup. Repeat with a slow/offline network
and a screen resume. Browser previews and CI compilation do not test native
camera hardware. For standalone testing use the EAS `preview` build profile.
