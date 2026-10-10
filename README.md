# Nearry — MVP (Milestones 1–4)

React Native + Expo app with a Nothing-inspired black/white/red UI.
Two experiences behind one welcome screen:

- **Personal** — Nearby · Search · Create Post · Activity · Profile
- **Business** — Dashboard · Create Offer · Bookings · Messages · Business

Backend: Supabase (Postgres + Auth + Realtime). When no credentials are set,
real auth/data calls fail with a clear error and the welcome screen offers an
explicit **demo mode** — failed real auth is never silently treated as a login.

## Prereqs

- Node 18+
- `npx expo`
- iOS Simulator / Android emulator, or the Expo Go app on your phone

## Setup

```bash
cd nearry
npm install
cp .env.example .env   # fill in Supabase URL + anon key (see below)
npx expo start
```

Scan the QR code with Expo Go, or press `a` / `i` for an emulator.

## Environment

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |

`EXPO_PUBLIC_*` values are baked in at bundle time — the CI workflow injects
them from GitHub Actions secrets (see `.github/workflows/build-apk.yml`).

## Supabase setup

1. Create a project at supabase.com (region `ap-south-1` recommended).
2. SQL Editor → run the files in `supabase/migrations/` **in numeric order**
   (`00001_baseline.sql` … `00007_post_readmodel.sql`). Details in
   `supabase/migrations/README.md`.
3. Auth → Providers → enable **Email** (OTP) and **Google**:
   - Google needs a Google Cloud OAuth client (web application type).
   - Auth → URL Configuration → Redirect URLs: add `nearry://auth/callback`.
4. Copy the project URL + anon key into `.env`, restart Expo.
5. Scheduled job: call the `close_expired_posts()` RPC every 15–60 min
   (Supabase dashboard cron / pg_cron / any external scheduler with the
   service key). Expiry is also enforced inside `approve_join_request()` and
   filtered in list queries, so the app stays correct if the cron lapses.

No app-side Google client ids are needed — OAuth runs through Supabase.

## Auth model

- **Passwordless email OTP**: 6-digit code, no passwords, no phone numbers.
- **Google**: `supabase.auth.signInWithOAuth({ provider: 'google' })` opened
  via `expo-web-browser`; the code is exchanged with
  `supabase.auth.exchangeCodeForSession`.
- **Sessions** come from `supabase.auth.getSession()` + `onAuthStateChange`
  (persisted via AsyncStorage) — never a locally stored user object.
- **Profiles**: one `profiles` row per user (auto-created by the
  `handle_new_user` trigger). The saved `account_type` decides which
  experience a returning user lands in, regardless of which login screen they
  used. Incomplete onboarding resumes automatically.
- **Demo mode** is explicit (welcome screen button) and visually badged.

## Data model

`src/services/mappers.ts` is the single place where Postgres rows
(snake_case) become app models (camelCase) — services never `as`-cast rows.

Key server guarantees (see `supabase/migrations/`):

- `approve_join_request()` — row-locked, atomic approval; concurrent
  approvals serialize and can never overfill a post. Direct `UPDATE`s to
  `status = 'approved'` are rejected by RLS; approvals must go through the RPC.
- `close_post_when_full` trigger + `reopen_post_if_space` trigger keep
  `open`/`closed` in sync with capacity (withdrawals reopen fill-closed posts,
  never expired ones).
- `guard_post_edit` trigger — host edits: author only, open posts only,
  vacancies never below approved count, start stays future.
- `protect_profile_fields` trigger — clients cannot change
  `verification_status` (admin-managed via service key).
- `close_expired_posts()` — server-side expiry closure (see cron above).

## Project structure

```
App.tsx                  Entry — AuthProvider + NavigationContainer
src/theme/               Nothing design system (colors, typography, spacing)
src/components/          Screen, Button, Input, Card, Badge, Avatar, EmptyState, PostRow
src/navigation/          RootNavigator (session/profile gating), PersonalStack,
                         PersonalTabs, BusinessTabs
src/store/               AuthContext (Supabase session, profile, demo mode)
src/screens/
  WelcomeScreen.tsx
  auth/                  Shared OTP AuthScreen + Personal/Business wrappers
  onboarding/            Personal/Business onboarding (persist to profiles)
  personal/              Nearby, Search, CreatePost, PostDetails, EditPost,
                         VenueDetails, Activity, Profile
  business/              Dashboard, CreateOffer, Bookings, Messages, Business
src/services/
  supabase.ts            Client (AsyncStorage session) + isSupabaseConfigured()
  auth.ts                Email OTP + Google-via-Supabase (no mock fallback)
  mappers.ts             Explicit DB row <-> app model mappings
  venues.ts              List/search/nearby/detail (PostGIS RPC)
  posts.ts               CRUD + post_cards read model + realtime subscribe
  joinRequests.ts        Request/withdraw/approve(RPC)/decline + lists
  location.ts            Permissions + position + haversine
  offers.ts              Business offers (M5)
  chat.ts                Threads/messages stubs (M6)
  notifications.ts       Push stubs (M6)
src/utils/validation.ts  Client validation mirroring DB CHECKs
src/data/mock.ts         Explicit demo-mode fixture data
supabase/
  schema.sql             Baseline snapshot (= migrations/00001)
  migrations/            00001–00007, versioned, non-destructive
```

## Milestones

- **M1** — Real auth (OTP + Google via Supabase), session restore, profiles,
  account-type routing, onboarding resume, explicit demo mode.
- **M2** — Versioned migrations, RLS + ownership policies, protected fields,
  explicit field mappings, client+server validation.
- **M3** — Seeded venues, venue/post details, post creation (venue, future
  date/time, capacity, cost, expiry), search/filter, loading/empty/error/retry
  states, realtime refresh, host edit/cancel with server rules.
- **M4** — Join requests (request/withdraw/approve/decline), atomic approval
  RPC, no self-join/duplicates/closed-expired joins, withdrawal reopens,
  server expiry, cross-device realtime sync.
- **M5** — Business verification, offers, bookings (next).
- **M6** — Chat + notifications (next).
- **M7** — Testing + delivery (next).

## Status: completed vs remaining

**Working (needs live Supabase to exercise):** OTP login/signup, Google OAuth
flow, session restore, profile routing, onboarding resume, venue list/search/
nearby/detail, post create/list/detail/edit/cancel, join request/withdraw/
approve/decline, atomic capacity, expiry, realtime sync, demo mode.

**Still mock:** business offers/bookings lists (M5), chat + notifications
(M6), live-offer cards on Nearby (M5), profile stats (placeholder).

**Blocked by missing credentials:** everything under "Working" above —
no Supabase project exists yet, so no live integration has been tested.
Type checks (`tsc` strict) and 31 logic tests (mappers, validation) pass.
The acceptance flow (A posts → B,C request → A approves both → 0 spots,
post closes, restart preserves) is implemented end-to-end but awaits a live
project for the multi-device run.

## Design language

Nothing-inspired: pure black `#000`, white text, signal red `#D71920`
reserved for primary actions and live states. Dot-matrix monospace for
display type and micro-labels (uppercase, wide tracking), sharp 2px corners,
1px borders. If it looks soft, it's wrong. (Full visual redesign deferred —
current UI stays usable.)
