# Nearry Premium setup

Nearry Premium is a subscription sold through Google Play and managed by
RevenueCat (a service that tracks who has paid). Do these steps in order; the
order matters. Plan for a day or two in total: most steps are quick, but
Google's service credentials (step 4) can take up to a day to start working.
Nothing here changes the app for users until the new build is released.

Prices: weekly ₹49, monthly ₹149, three months ₹349. Google Play converts them
to other countries' currencies automatically. You can adjust them later in Play
Console.

## 1. RevenueCat: project and app

1. Make a free account at revenuecat.com → **Create project** → name it
   `nearry`.
2. **Add app → Google Play**. When it asks for the package name, enter
   `com.nearry.app`.
3. **API keys**:
   - Copy the **Public** Google Play SDK key (starts with `goog_`). You use it
     in step 2.
   - Create a **Secret** API key (v1). You use it in step 6. Never put it in the
     app or on GitHub.

## 2. App key, then build and upload

Play Console only lets you create subscriptions after you have uploaded an app
version that supports purchases. This Premium build is that version.

The app reads `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`: the public `goog_` key.

1. GitHub → the repo → Settings → Secrets and variables → Actions →
   **Variables → New**: name `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, value the
   `goog_` key. (Used by the test APK build.)
2. EAS (expo.dev) → the project → Environment variables → add the same name and
   value for **production** and **preview**. Set visibility to **Plain text** or
   **Sensitive**, not "Secret". It is a public key that is bundled inside the
   app.
3. Make a Play build (see `docs/play-test-release.md`) and upload it to the
   **Internal testing** track in Play Console.

It is fine that no products exist yet. Until they do, the Premium sheet shows
"Plans couldn't load" with a Try again button, and nothing can be bought.

## 3. Google Play: the subscription

1. Open Play Console. If asked, finish the **Payments profile** (Setup →
   Payments profile). You can't sell anything without it.
2. Choose the Nearry app → **Monetize with Play → Products → Subscriptions →
   Create subscription**. If Play says to upload a build first, step 2 isn't
   finished or is still processing; wait and retry.
3. Product ID: `nearry_premium` (type it exactly). Name: `Nearry Premium`.
4. Add three **base plans**. For each, set the Base plan ID, billing period,
   and price, then **Activate** it:
   - `weekly`: auto-renewing, every 1 week, ₹49.
   - `monthly`: auto-renewing, every 1 month, ₹149.
   - `quarterly`: auto-renewing, every 3 months, ₹349.
5. Activate the subscription itself.

## 4. RevenueCat: Play access, products, entitlement, offering

1. RevenueCat needs permission to read Play purchases. Open the app in
   RevenueCat and follow its on-screen **Service credentials** guide: in Google
   Cloud create a service account, download its JSON key, upload it to
   RevenueCat, then in Play Console → Users and permissions invite the service
   account's email and give it permission to view financial data and manage
   orders. This can take up to a day to start working.
2. **Products → Add product**: choose `nearry_premium` and import the three base
   plans (`weekly`, `monthly`, `quarterly`).
3. **Entitlements → New**: identifier exactly `premium`. Attach all three
   products to it.
4. **Offerings**: open the offering called `default` (create it if missing) and
   make it **current**. Add three packages:
   - **Weekly** package type → the weekly product.
   - **Monthly** package type → the monthly product.
   - **Three Month** package type → the quarterly product.

   Use these built-in package types, not custom ones.

## 5. RevenueCat webhook

A webhook is a message RevenueCat sends us when someone subscribes or cancels.

1. Make up a long random password (30+ letters and numbers). This is your
   `REVENUECAT_WEBHOOK_SECRET`. Save it somewhere safe.
2. RevenueCat → **Integrations → Webhooks → Add**.
3. URL: `<SUPABASE_URL>/functions/v1/revenuecat-webhook` (your Supabase project
   URL, for example `https://abcd.supabase.co/functions/v1/revenuecat-webhook`).
4. Authorization header value: `Bearer ` followed by your secret, exactly:
   `Bearer <REVENUECAT_WEBHOOK_SECRET>` (one space after Bearer).
5. Save. Don't send a test event until step 6 is done.

## 6. Supabase: secrets and deploy

1. Supabase dashboard → your project → **Edge Functions → Secrets** (or use the
   CLI `supabase secrets set`). Add:
   - `REVENUECAT_WEBHOOK_SECRET` = the password from step 5.
   - `REVENUECAT_API_KEY` = the RevenueCat **secret** key from step 1.
2. On your computer, in the project folder, run:
   `supabase functions deploy revenuecat-webhook --no-verify-jwt`
   (`--no-verify-jwt` is needed because RevenueCat doesn't log in as a user; the
   secret header protects it instead.)
3. In RevenueCat, send the webhook's **Test** event. It should show success.

## 7. Database migrations

1. See which migrations are already applied: Supabase dashboard → **Database →
   Migrations**.
2. Apply any earlier migrations not yet applied (for example `00044` and
   `00045`), in number order, in the **SQL editor**.
3. Wait until the Premium build has reached your users (the rollout is live and
   people have updated). Only then run
   `supabase/migrations/00046_premium_limits.sql`, then
   `supabase/migrations/00047_hosted_by_filter.sql`. 00046 turns on the daily
   limits; older builds don't know about them and would show people the raw
   text `daily_plan_limit` instead of the Premium sheet.

### Before going live

Run the external-database test suite once against a staging database. Create a
disposable database named `nearry_test` with the PostGIS extension, then run
the tests with `TEST_DATABASE_URL` pointing at it. The normal test run skips
the checks for `nearby_post_cards` and the daily-limit concurrency lock because
they need a real PostGIS database.

## 8. Privacy page and Play forms

The privacy text now has a "Purchases" section.

1. Run `npm run legal:export` and upload the new `dist-legal/privacy.html` to
   wherever the privacy page is hosted, replacing the old one.
2. Play Console → App content → Data safety: declare **Purchase history**
   (Financial info) as collected, linked to the account, for app functionality,
   shared with RevenueCat as a service provider. Details are in
   `docs/play-data-safety.md`.

## 9. Test without paying

1. Play Console → **Settings → License testing**: add the Gmail addresses of
   your testers. Testers are never charged.
2. Install the build from the internal testing track on a phone signed into
   that Gmail account.
3. Open Premium in the app and buy a plan. Check that Premium turns on, and that
   RevenueCat → Customers shows the purchase under the person's Nearry account
   id.
4. Cancel in Play Store → Subscriptions and check that Premium ends at the end
   of the period.

If Premium doesn't turn on: check the webhook shows delivered in RevenueCat,
and look at Supabase → Edge Functions → revenuecat-webhook → Logs.
