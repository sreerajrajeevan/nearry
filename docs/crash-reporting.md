# Crash reporting and usage numbers

## What's in the app

- **Sentry crash reports** from phone builds that have a DSN. Covers app crashes
  (JavaScript and native) and the "Something went wrong" screen.
- **Privacy:** no user, account ID, IP address, screenshots or performance
  tracing. Taps, typed text and console lines are never sent. URLs lose their
  query. Anything that looks like an email, phone number, token or coordinates
  is masked on the phone before sending (`src/utils/crashScrub.ts`). Only screen
  names (no route details) and the account side (personal/business) are kept.
- **Error screen:** a crash inside a screen shows "Something went wrong · Try
  again" instead of closing the app.
- Without a DSN (local dev, web, or before setup) nothing is sent.

## Setup (about 10 minutes)

1. Create a free account at sentry.io → **Create project → React Native** →
   name it `nearry`. Copy the **DSN**.
2. In the Sentry project **Settings → Security & Privacy**: turn on **Prevent
   storing of IP addresses** and keep **Data scrubber** on. Set retention to 90
   days or less (the free plan keeps 30 days).
3. GitHub → Settings → Secrets and variables → Actions → **Variables** → New:
   `EXPO_PUBLIC_SENTRY_DSN` = the DSN. The next APK reports crashes, tagged
   `debug-apk`.
4. For Play builds (EAS): add the same `EXPO_PUBLIC_SENTRY_DSN` as an EAS
   environment variable for `production` (and `preview` if used).
5. Optional, for readable stack traces in Play (release) builds: create a
   Sentry auth token (Settings → Auth Tokens, scope `project:releases`), add
   EAS secrets `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, and remove
   `SENTRY_DISABLE_AUTO_UPLOAD` from `eas.json`. Without this, release
   builds still report crashes; the traces are just harder to read.

Check it: install the new build and look at Sentry → Issues. To test once,
temporarily throw an error in a screen in a test build; don't ship that.

## Usage numbers (no extra tracking)

`supabase/ops/usage-report.sql` answers "is it working?" from data the app
already stores. Paste a block into the Supabase SQL editor:

1. Sign-up funnel by week: signed up → finished onboarding → posted → asked to
   join → joined → chatted.
2. Weekly activity and active people.
3. Share of plans that get a request / a member (is there enough activity?).
4. Coming back: active one week and again the next.
5. Business offers and bookings.

All results are counts, never lists of people. During testing, sample and
reviewer accounts are included.

The privacy policy (`src/utils/legal.ts`, "Crash reports") and
`docs/play-data-safety.md` now cover Sentry. Re-export and re-host the policy
pages (`npm run legal:export`), and in Play Console Data safety declare
**Crash logs** and **Diagnostics** as collected, not shared for advertising,
not linked to identity, for app functionality/analytics.
