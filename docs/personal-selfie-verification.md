# Optional personal selfie verification (migration 00026)

This feature does **not** establish legal identity, age, uniqueness, or live-person
presence. A photo can be spoofed. It is a manually reviewed comparison against
the current public profile picture, shown as **Selfie checked**, not ID verified.

## Setup

1. Back up the existing database and apply only missing migrations, including
   `00026_personal_selfie_verification.sql`. Never rerun `run-all.sql`
   on an existing database.
2. Rebuild the mobile app: expo-image-picker now asks for CAMERA permission.
   No microphone permission or broad photo access is needed.
3. Confirm `selfie_proofs` is a **private** Storage bucket and its policies
   only permit the owner to upload/view their own proof. Review images must
   never appear in public galleries, posts, notifications or logs.
4. Configure an actual, staffed moderator who can review submissions promptly.
   The reviewer uses a trusted service-role context, never a key shipped to the
   mobile app. Review queue:
   ```sql
   select r.user_id, p.display_name, p.avatar_url, r.selfie_path, r.submitted_at
   from public.personal_selfie_reviews r
   join public.profiles p on p.id=r.user_id
   where r.status='pending'
   order by r.submitted_at;
   ```
   Retrieve each private image through the Supabase dashboard as a trusted
   operator and compare to the current public profile photo. Approve only if
   both clearly depict the same person; reject unclear, inconsistent or
   apparently fabricated images. Do not claim automated liveness.
   ```sql
   -- In a trusted service-role session after inspecting the private proof:
   select public.review_personal_selfie('USER_UUID','verified',null);
   -- Or reject, with a useful reason:
   select public.review_personal_selfie('USER_UUID','rejected','Face not clearly visible');
   ```
   Review decisions queue selfie images for deletion by the existing
   `account-maintenance` media-cleanup worker. Confirm it is scheduled
   and processes the new bucket. Check queue/backlog regularly.
5. Review privacy copy, consent, retention, and Google Play Data safety before
   release. Real-user data should not be collected until a staffed review and
   privacy workflow is ready.

## Security properties

- Personal account only; an existing public profile picture is mandatory.
- Submission requires a deliberate unchecked consent control and server-side
  `p_consent=true`, and is rejected for inactive/deleting accounts.
- Proof is private, submitted under the signed-in user's Storage prefix.
- Clients can view their own status and note, but not change verdicts.
- Only service_role may call `review_personal_selfie`.
- Other members can only query the approved boolean, never the proof or notes.
- Changing the profile photo revokes an existing check and queues any pending
  photo for cleanup; a new submission is required.
- Submission is restricted while pending/verified and briefly rate-limited
  after rejection. Camera-only UI does not stop modified clients from uploading
  another image: a review process or certified liveness provider is still needed.
- Account deletion worker removes any unreviewed private file under the user's
  storage prefix before deleting Auth data.
- This release does not forcibly block unverified users from joining activities.
  Do that only after establishing moderator capacity, appeals, and accessibility
  alternatives.

## Release tests

On a staging backend, take a selfie from the Android camera and verify private
upload, consent, pending status, verified/rejected paths, public badge on post
details, profile-photo-change invalidation, blocked file access, cleanup queue,
and complete account deletion. Test camera denied and screen resume. This has
not been validated against the production Supabase project.
