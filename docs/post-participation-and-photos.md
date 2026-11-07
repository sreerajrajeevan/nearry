# Post editing, photo crop and participation profiles

These changes extend PR #26 without replacing its chat fixes.

## Photos

Create and Edit share `PostEditor` and `PostPhotosField`. The system photo picker is used only to select a post image; Nearry's crop modal supplies safe-area-aware Cancel and Done controls, square/portrait/landscape framing, dragging, zoom and reset. The image is normalized for orientation, cropped using the same geometry as the preview, saved as JPEG and limited to 1600 pixels on its longest side. No broad media-library permission is added.

Existing photos can be replaced or removed in Edit. Uploads finish before `set_post_photos` atomically applies the complete selection. Retained photos keep their IDs; replacement preserves selection order, including the cover. Upload/RPC failures retain successful upload URLs for retry and leave existing attachments intact. Metadata saves separately: if the photo step fails, the screen explains that the post/details are already saved and offers retry or keeping the previous photo selection. This does not implement unsending/deleting Storage objects; normal account file cleanup remains unchanged.

## Full editor

Create and Edit use the same venue selector, date/time pickers, title, details, spots, cost, gender audience, request closing date/time, tags and photo field. Clearing optional venue/cost/closing time sends explicit nulls. Existing restrictions remain: only the host can edit upcoming, open posts, and spots cannot fall below approved participants. Changing audience cannot exclude approved participants; pending/full requests that no longer match are declined without consuming a rejection chance.

## Optional profile completion

Authenticated Personal users, including first-time Google users, may browse before onboarding completion. Business onboarding remains unchanged. Create and Join prompt for profile completion; Profile also offers a completion link. Required details are name (2–40 characters), gender and self-declared age (18–100). An existing current terms acceptance is preserved; otherwise completion requires the existing explicit agreement control. This is self-declaration, not verified age or identity.

Age is stored privately on profiles and returned only through the owner-scoped `get_my_profile`; public profile column grants exclude it. Existing accounts are not assigned an inferred age/gender. They receive the prompt on their next Create/Join if details are missing. Gender changes and age corrections are available in Edit profile.

The server enforces a complete Personal profile for posting and join requests/approvals, including RPC/direct-write attempts. Female/male audiences require the matching saved gender; Anyone includes Other. Feed, post details, host activity and My posts display text-and-icon audience badges, with pink female and blue male accents.

## Rollout and verification

Apply `00028_post_audience_readmodel.sql` after 00027, including on existing projects. The original `post_cards` view expanded `posts.*` before `gender_preference` existed, so detail/feed/My posts lost the saved audience and displayed Anyone. The forward migration appends the saved field while preserving view columns, grants and caller RLS; it refreshes the API schema cache. No posts or participation records are rewritten. Existing saved female/male restrictions display correctly after reloading the post; legacy null audiences remain unrestricted. This database-only correction needs no additional native build. Regression tests exercise real insert → view reads → edit → view rereads for all three audiences, alongside service serialization and existing join enforcement.

Apply only migration `00027_post_participation_and_photos.sql` after 00026. Do not replay run-all.sql. It adds the private age column, completion RPC, eligibility policies/triggers and atomic photo RPC. It does not infer missing details, change existing profiles, remove photos, or cancel existing participation during installation. Existing pending requests are rechecked at approval.

**An updated native app build is required** because `expo-image-manipulator` is new. Coordinate the new build with the backend rollout: older clients cannot complete the new required fields. Reloading an old standalone binary is insufficient.

Tests cover missing/underage profiles, private age access, required agreement, posting/join bypasses, matching/mismatched audiences, approval revalidation, audience edits, atomic photo replacement and upload retry. Browser checks use fabricated sessions and an isolated backend: real image cropping/drag/zoom, Done/Cancel bounds at multiple sizes, cancel/remove/replace, editor round trips, typed time, optional browsing and completion returning to Create. Before release, repeat the flow on Android and iOS phones, including gesture navigation, keyboard, rotated photos, large images and interrupted connectivity. No browser check proves every OEM picker/device behavior.
