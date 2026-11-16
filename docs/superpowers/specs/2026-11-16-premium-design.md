# Nearry Premium — design

Status: draft for Sree's approval · 16 Nov 2026

## Why

Sree wants Nearry to earn money the way similar apps (AskOut) do: a paid
subscription that removes daily limits and unlocks a "Hosted by" filter.
Ads (switchable from the server) and Boost come later and build on this.

## Goals

- **Nearry Premium** subscription through Google Play: ₹49 / week,
  ₹149 / month, ₹349 / 3 months, auto-renewing.
- **Free daily limits, same for every user:** 3 new plans and 10 join
  requests per day (India day, midnight IST). Premium: unlimited.
- **"Hosted by" filter (Premium):** Women / Men / Non-binary / Everyone. Shows
  only plans whose host has that gender. Anyone can buy it.
- An **upgrade sheet** that slides up when someone taps the locked filter or
  hits a daily limit, AskOut-style: what Premium unlocks, the three plans,
  one big button, Restore and Not now.
- Limits and the filter are **enforced on the server**, not only hidden in
  the app.

## Non-goals (this round)

- Boost, Google ads, Business Pro (later; ads get an on/off switch then).
- iPhone payments (Android only for now; RevenueCat makes iOS easy later).
- Any gender-based pricing or limits: everyone pays the same.

## Anti-goals (would be a failure even if it works)

- Women-only plans becoming paid. The host's "Women only" audience setting
  stays free and unchanged; it is a separate feature from the filter.
- Exposing any individual's gender. Other users still cannot read a
  profile's gender; the filter runs inside the database.
- A paying user losing Premium because of a sync glitch, or a free user
  getting it free because the app was modified.

## Approaches considered

1. **RevenueCat + Google Play subscriptions (chosen).** RevenueCat checks
   purchases with Google, handles renewals, cancellations, refunds and grace
   periods, and calls our server when status changes. Free while revenue is
   small. Least custom money code.
2. **Google Play Billing directly.** No middleman, but we would build and
   maintain receipt checks with Google's API, renewal and refund handling
   ourselves. More code where bugs cost money.

Sree picked 1.

## How it works

### Who is Premium (server truth)

- New table `premium_entitlements (user_id, expires_at, product_id,
  store, updated_at)`. Readable only by its owner; written only by the
  server.
- `has_premium(user_id)` = an entitlement whose `expires_at` is in the future.
- New edge function **`revenuecat-webhook`**: RevenueCat calls it on every
  purchase, renewal, cancellation, expiry and refund. It checks a shared
  secret header, then asks RevenueCat's API for the subscriber's current
  status (never trusting the webhook body alone) and upserts the row.
- The app identifies to RevenueCat with the Supabase user id, so a purchase
  always belongs to the signed-in account and follows them to a new phone
  (Restore).

### Daily limits

- New table `daily_usage (user_id, day, kind, count)`, `kind` in
  `plan` / `join`. A trigger on new posts and on `request_join` increments it
  and raises `daily_plan_limit` / `daily_join_limit` when a free user is over
  3 / 10 for today (IST). Counting usage, not current rows, means deleting a
  plan does not give the slot back.
- Premium users are counted but never blocked.
- Edits, withdrawing a request and re-sending the same request do not count.

### "Hosted by" filter

- `nearby_post_cards` gets an optional `p_host_gender` argument. If set and
  the caller is not Premium, it raises `premium_required`; otherwise it
  filters by the host's profile gender in the database.
- In the plan filter sheet, a new **Hosted by** row: *Everyone* (free) plus
  Women / Men / Non-binary with a 🔒 Premium badge for free users.
- If Premium ends, the saved filter quietly resets to Everyone.

### The app

- `react-native-purchases` (RevenueCat SDK) in the native build; the public
  Android SDK key comes from `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`. Without
  the key (web, demo, old builds) Premium shows as unavailable and nothing
  breaks.
- `PremiumContext`: current status (from our server, refreshed on purchase,
  app foreground and webhook-driven realtime), offerings and prices from
  Google (shown in the user's currency), `purchase()`, `restore()`.
- **Upgrade sheet** (native bottom sheet, Nearry amber/ink style): context
  line ("You've posted 3 plans today" or "Filter by who's hosting"), perks
  row (Unlimited plans · Unlimited joins · Hosted by filter), three plan
  cards with savings, Google's required renewal text, Privacy Policy and
  Terms links, **Get Premium**, Restore, Not now.
- Profile: a "Nearry Premium" row: upgrade if free; "Active until …" and
  "Manage subscription" (opens Google Play subscriptions) if Premium.
- Limit errors from the server open the sheet instead of a plain error.
- Demo mode shows the sheet but purchasing is disabled.

## What Sree sets up (I'll write step-by-step docs)

1. Play Console: a payments (merchant) profile, then one subscription
   `nearry_premium` with three base plans: weekly ₹49, monthly ₹149,
   3-monthly ₹349. Requires the app on at least the internal testing track.
2. RevenueCat (free): project, Android app linked to Play with a Google
   service-account key, entitlement `premium`, offering with the three plans.
3. Webhook: URL of `revenuecat-webhook` + secret → RevenueCat; secret and
   RevenueCat API key → Supabase function secrets.
4. `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` → GitHub variable and EAS.
5. Privacy policy + Play Data safety: purchase history via Google/RevenueCat.

## Testing

- Database tests (PGlite): limits per IST day, Premium bypass, delete does
  not refund, filter refuses free users, gender never selectable by others.
- Webhook tests with a fake RevenueCat API: grant, renew, expire, refund,
  bad secret.
- Real purchase test with Play license testers (no money charged).

## Calls made in writing this (check these)

- Profile gender "other" shows as **Non-binary** in the filter.
- A join request counts when sent, even if the host later declines it.
- The Hosted by filter applies to the Nearby plan feed (not offers or Search)
  this round.
- Premium is for personal accounts only; business accounts don't see it.

## Left to the builder

Exact sheet layout and copy within the above, file and component names,
how often status refreshes, and test structure.
