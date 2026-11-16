# Push notifications: one-time setup

The app side is done: after sign-up and onboarding, Nearry asks once
"Turn on notifications?". **Allow** opens the phone's permission dialog,
registers the phone, and from then on join requests, approvals, bookings and
messages arrive as push notifications. Settings → Notifications can still turn
them on or off later.

For a notification to actually reach a phone, five pieces must be in place.

## 1. Firebase (Android delivery)

1. Open the Firebase console and create or open a project.
2. **Add app → Android**, package name `com.nearry.app`. Download
   **google-services.json**.
3. GitHub → repository **Settings → Secrets and variables → Actions → New
   repository secret**: name `GOOGLE_SERVICES_JSON`, value = the whole contents
   of that file. The APK workflow writes it into the build and checks it is for
   `com.nearry.app`. Without it the build logs a warning and phones get no push.
   For EAS builds, upload the same file as the EAS file variable
   `GOOGLE_SERVICES_JSON` instead (see android-release.md).

## 2. Let Expo send through Firebase

1. Firebase → Project settings → **Service accounts → Generate new private
   key**. Keep this JSON private; never commit it.
2. expo.dev → project **nearry** (`f70e106f-…`) → **Credentials → Android →
   com.nearry.app → FCM V1 service account key → Upload** that JSON.
   (Or `npx eas-cli credentials --platform android`.)

## 3. Supabase: the sender

1. Edge Functions → Secrets: set `PUSH_DISPATCH_SECRET` to a long random value.
   If Expo "enhanced push security" is on, also set `EXPO_ACCESS_TOKEN`.
2. Deploy: `supabase functions deploy send-push --no-verify-jwt`.
3. Run `supabase/ops/schedule-send-push.sql` once in the SQL editor (it
   explains the Vault step). It calls `send-push` every minute, so a
   notification arrives within about a minute.

## 4. New APK

Install a build made after steps 1–2. The permission prompt and Firebase
config are native changes; an older APK cannot receive push.

## 5. Test

1. Sign up (or sign in) on the phone, finish onboarding, tap **Allow
   notifications**.
2. From a second account, ask to join a plan from the first account, or send
   it a message.
3. Within a minute the phone shows the notification; tapping it opens the
   right screen.

If nothing arrives:

- `select * from push_tokens order by updated_at desc limit 5;` — no row means
  the phone did not register (check step 1, step 4, and that permission was
  allowed).
- `select notification_id, attempts, sent_at, last_error from push_jobs order by next_attempt_at desc limit 5;` — `sent_at` empty
  means the sender is not running (step 3; see the checks in the SQL file).
- `select status, last_error from push_deliveries order by created_at desc limit 5;`
  — `InvalidCredentials` or similar means step 2.
