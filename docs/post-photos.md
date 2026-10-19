# Post photos

Create Post supports up to five photos (JPEG, PNG or WebP; 10 MB each). The system image picker grants access to the selected item without requiring full-library access. Cropping and preview remain available. The first successfully attached photo is the feed thumbnail; posts without photos use one of twelve original activity miniatures selected from their content. These are separate from the four larger home scenes. Unrecognised plans use a neighbourhood bench, and failed photo thumbnails fall back to the relevant artwork.

## Supabase setup

The existing `00023_visual_richness.sql` migration creates the public `photos` bucket, `post_photos`, and policies allowing only the post's author to attach/delete its photos. Apply only missing migrations in order using the migration README. This fix adds no migration, bucket or key. No service-role key belongs in the app.

Photo files use `<user-id>/posts/<unique-name>.<actual-extension>`. The shared upload helper reads native files through Expo FileSystem and web files through an ArrayBuffer, detects JPEG/PNG/WebP from the bytes, and uploads through the authenticated Supabase SDK with the matching content type and `upsert: false`. It replaces the old forced-JPEG multipart URI upload. This helper is also used by offer and venue photo uploads.

## Failure and retry behaviour

The post is created once, then attachments save in order. A failed upload or database attachment is shown on screen rather than ignored. The composer retains the saved post ID, unsaved photos and any already-uploaded URL; Retry photos resumes attachments without creating a second post or reuploading an image whose database attachment failed. A response-loss retry checks existing URLs before inserting a duplicate. Skip remaining photos opens the saved post and discards only the unsaved attachments in the composer. Pending retry state lasts while the composer is mounted; reloading or signing out discards it.

Post details load the gallery independently, so a photo error does not prevent viewing or joining the plan. Gallery failures offer Retry photos. Feed photos are fetched in batches; if that optional request fails, the category art is used. Feed and gallery refresh on focus and foreground return. Uploaded photos remain publicly readable, as configured by migration 00023; only post photos, not private verification documents, use this bucket.

In explicit demo mode, selected photos remain local to the current app session; they are not uploaded to Supabase and disappear after a reload.

## Verification

- Browser demo: choose a photo, preview/remove it, publish, open its gallery/full-screen view, and check the feed cover. A successful publish clears the next draft's photos and audience preference.
- Automated service tests: raw binary/MIME/API-key upload, storage denial, file limits, batch cover mapping, saved-order retry, upload reuse, duplicate-attachment retry and session-only demo photos.
- Database tests: host can attach/remove a photo; another user can view it but cannot insert or delete the host's attachments.
- Before release, test a signed-in account on Android/iOS against the configured Supabase project: JPEG and PNG selection, slow/offline upload and retry, image viewing after relaunch, and a second account reading the same post. Native device and live-project checks cannot be replaced by browser demo or mocked HTTP tests.

If the composer reports a missing table or bucket, check migration 00023 in that project. For a denied upload, confirm the current user owns the first folder segment and the storage policies from that migration exist. Errors are displayed without logging credentials.

References: [Supabase Expo upload example](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native), [Expo SDK 52 picker source](https://github.com/expo/expo/blob/sdk-52/packages/expo-image-picker/src/ImagePicker.ts).
