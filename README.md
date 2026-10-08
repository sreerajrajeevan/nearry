# Nearry — MVP (Milestone 1)

React Native + Expo app with a Nothing-inspired black/white/red UI.
Two experiences behind one welcome screen:

- **Personal** — Nearby · Search · Create Post · Activity · Profile
- **Business** — Dashboard · Create Offer · Bookings · Messages · Business

Backend: Supabase (optional in milestone 1 — the app runs in **mock mode**
with local data when no credentials are set).

## Prereqs

- Node 18+
- Expo CLI: `npm i -g expo-cli` (or use `npx expo`)
- iOS Simulator / Android emulator, or the Expo Go app on your phone

## Setup

```bash
cd nearry
npm install
cp .env.example .env   # fill in when ready; empty = mock mode
npx expo start
```

Scan the QR code with Expo Go, or press `a` / `i` for an emulator.

## Environment

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth web client id |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google OAuth iOS client id |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Google OAuth Android client id |
| `EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID` | Google OAuth id for Expo Go dev (uses Expo proxy) |

Leave all empty to run in mock mode: any email/password signs in,
Google sign-in returns a demo user. A `MOCK MODE` badge shows on auth/profile
screens so you always know which backend is live.

### Google OAuth setup

1. Google Cloud Console → create OAuth 2.0 clients (Web, iOS, Android).
2. For Expo Go dev, add `https://auth.expo.io/@your-expo-username/nearry`
   as an authorized redirect URI on the Web client.
3. Put the ids in `.env`. Standalone builds use the platform client ids;
   Expo Go uses the Expo client id via the Expo proxy.

### Supabase setup (milestone 2)

1. Create a project at supabase.com.
2. SQL editor → paste `supabase/schema.sql` → run.
3. Auth → enable Email + Google providers (Google needs the same OAuth clients).
4. Copy URL + anon key into `.env`, restart Expo.

The `profiles` table expects a row per user with `account_type`
(`personal`/`business`); add a DB trigger or handle it in the signup flow
when you wire milestone 2.

## Project structure

```
App.tsx                  Entry — AuthProvider + NavigationContainer
src/theme/               Nothing design system (colors, typography, spacing)
src/components/          Screen, Button, Input, Card, Badge, Avatar, EmptyState
src/navigation/          RootNavigator (role gating), PersonalTabs, BusinessTabs
src/store/               AuthContext (session, mock fallback, onboarding gate)
src/screens/
  WelcomeScreen.tsx
  auth/                  PersonalAuthScreen, BusinessAuthScreen
  onboarding/            PersonalOnboardingScreen, BusinessOnboardingScreen
  personal/              Nearby, Search, CreatePost, Activity, Profile
  business/              Dashboard, CreateOffer, Bookings, Messages, Business
src/services/
  supabase.ts            Client + isSupabaseConfigured()
  auth.ts                Email + Google OAuth (mock fallback)
  location.ts            Permissions + position + haversine (M2: proximity)
  venues.ts              Search/detail (M2: PostGIS)
  posts.ts               Need-People posts (M2: vacancy auto-close)
  joinRequests.ts        Join flow stubs (M2)
  offers.ts              Business offers incl. last-minute (M2)
  chat.ts                Threads/messages stubs (M3)
  notifications.ts       Push stubs (M3)
src/data/mock.ts         Milestone-1 fixture data
supabase/schema.sql      Tables, vacancy auto-close trigger, nearby_venues RPC
```

## Milestones

- **M1 (this)** — Project setup, theme, welcome, dual auth/onboarding,
  role-based navigation, all tab screens, mock data.
- **M2** — Wire Supabase: profiles, venue pages + PostGIS nearby,
  Need-People posts + join requests + vacancy auto-close trigger,
  business offers + bookings.
- **M3** — Chat (Realtime), push notifications, last-minute offer alerts.

## Design language

Nothing-inspired: pure black `#000`, white text, signal red `#D71920`
reserved for primary actions and live states. Dot-matrix monospace for
display type and micro-labels (uppercase, wide tracking), sharp 2px corners,
1px borders. If it looks soft, it's wrong.
