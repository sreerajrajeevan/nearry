# Nearry Premium setup

Nearry Premium is a subscription sold through Google Play and managed by
RevenueCat (a service that tracks who has paid). Do these steps in order. It
takes about an hour. Nothing here changes the app until the new build is out.

Prices: weekly ₹49, monthly ₹149, three months ₹349. Google Play converts them
to other countries' currencies automatically. You can adjust them later in Play
Console.

## 1. Google Play: the subscription

1. Open Play Console. If asked, finish the **Payments profile** (Setup →
   Payments profile). You can't sell anything without it.
2. Choose the Nearry app → **Monetize with Play → Products → Subscriptions →
   Create subscription**.
3. Product ID: `nearry_premium` (type it exactly). Name: `Nearry Premium`.
4. Add three **base plans**. For each, set the Base plan ID, billing period,
   and price, then **Activate** it:
   - `weekly`: auto-renewing, every 1 week, ₹49.
   - `monthly`: auto-renewing, every 1 month, ₹149.
   - `quarterly`: auto-renewing, every 3 months, ₹349.
5. Activate the subscription itself.

## 2. RevenueCat: project, key, entitlement, offering

1. Make a free account at revenuecat.com → **Create project** → name it
   `nearry`.
2. **Add app → Google Play**. Enter the Android package name of Nearry (same as
   in Play Console).
3. RevenueCat needs permission to read Play purchases. Follow RevenueCat's
   on-screen **Service credentials** guide: in Google Cloud create a service
   account, download its JSON key, upload it to RevenueCat, then in Play Console
   → Users and permissions invite the service account's email and give it
   permission to view financial data and manage orders. It can take a few hours
   to start working.
4. **Products → Add product**: choose `nearry_premium` and import the three base
   plans (`weekly`, `monthly`, `quarterly`).
5. **Entitlements → New**: identifier exactly `premium`. Attach all three
   products to it.
6. **Offerings**: open the offering called `default` (create it if missing) and
   make it **current**. Add three packages:
   - **Weekly** package type → the weekly product.
   - **Monthly** package type → the monthly product.
   - **Three Month** package type → the quarterly product.
     Use these built-in package types, not custom ones.
7. **API keys**:
   - Copy the **Public** Google Play SDK key (starts with `goog_`). Used in step 5.
   - Create a **Secret** API key (v1). Used in step 4. Never put it in the app
     or on GitHub.

## 3. RevenueCat webhook

A webhook is a message RevenueCat sends us when someone subscribes or cancels.

1. Make up a long random password (30+ letters and numbers). This is your
   `REVENUECAT_WEBHOOK_SECRET`. Save it somewhere safe.
2. RevenueCat → **Integrations → Webhooks → Add**.
3. URL: `<SUPABASE_URL>/functions/v1/revenuecat-webhook` (your Supabase project
   URL, for example `https://abcd.supabase.co/functions/v1/revenuecat-webhook`).
4. Authorization header value: `Bearer ` followed by your secret, exactly:
   `Bearer <REVENUECAT_WEBHOOK_SECRET>` (one space after Bearer).
5. Save. Don't send a test event until step 4 below is done.

## 4. Supabase: secrets and deploy

1. Supabase dashboard → your project → **Edge Functions → Secrets** (or use the
   CLI `supabase secrets set`). Add:
   - `REVENUECAT_WEBHOOK_SECRET` = the password from step 3.
   - `REVENUECAT_API_KEY` = the RevenueCat **secret** key from step 2.7.
2. On your computer, in the project folder, run:
   `supabase functions deploy revenuecat-webhook --no-verify-jwt`
   (`--no-verify-jwt` is needed because RevenueCat doesn't log in as a user; the
   secret header protects it instead.)
3. In RevenueCat, send the webhook's **Test** event. It should show success.

## 5. App key (GitHub and EAS)

The app reads `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`: the public `goog_` key.

1. GitHub → the repo → Settings → Secrets and variables → Actions →
   **Variables → New**: name `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, value the
   `goog_` key. (Used by the test APK build.)
2. EAS (expo.dev) → the project → Environment variables → add the same name and
   value for **production** and **preview**. (Used by Play builds.)
3. Make a new build. Older builds have no key and show no Premium option.

## 6. Database migrations

1. In the Supabase **SQL editor** apply any earlier migrations not yet applied
   (for example `00044` and `00045`), in number order.
2. Then run `supabase/migrations/00046_premium_limits.sql`, then
   `supabase/migrations/00047_hosted_by_filter.sql`.

Do this before releasing the new build.

## 7. Privacy page and Play forms

The privacy text now has a "Purchases" section.

1. Run `npm run legal:export` and upload the new `dist-legal/privacy.html` to
   wherever the privacy page is hosted, replacing the old one.
2. Play Console → App content → Data safety: declare **Purchase history**
   (Financial info) as collected, linked to the account, for app functionality,
   shared with RevenueCat as a service provider. Details are in
   `docs/play-data-safety.md`.

## 8. Test without paying

1. Play Console → **Settings → License testing**: add the Gmail addresses of
   your testers. Testers are never charged.
2. Install the new build on a phone signed into that Gmail account, from an
   internal testing track.
3. Open Premium in the app and buy a plan. Check that Premium turns on, and that
   RevenueCat → Customers shows the purchase under the person's Nearry account
   id.
4. Cancel in Play Store → Subscriptions and check that Premium ends at the end
   of the period.

If Premium doesn't turn on: check the webhook shows delivered in RevenueCat,
and look at Supabase → Edge Functions → revenuecat-webhook → Logs.
