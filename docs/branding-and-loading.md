# Nearry brand, launch animation and welcome

Nearry's approved original mark (dark-ink open location pin and independent
burnt-orange point) and original outlined wordmark stay unchanged. Their
committed masters remain `assets/brand/pin.png` and
`assets/brand/wordmark.png`. Do not substitute an AI-generated logo.

## Premium launch animation

`App.tsx` holds the native splash until fonts and brand assets are ready.
Both iOS and Android native launch images display a **single centered orange
point**, matching the first frame of the React animation and preventing an
old logo flash. Android 12 may mask or scale the native splash imagery.

`StartupSplash` tells one short, non-geographical Nearry story:

1. A solitary orange spark gently pulses.
2. An abstract wire globe appears using latitude/longitude-like curves
   **without borders, countries or location names**.
3. The globe pushes inward toward a destination pulse.
4. Thin orbital lines and a moving spark frame the **existing original logo**.
5. The exact Nearry symbol and wordmark appear; the spark fades where the
   brand's orange dot sits.

React animation takes about 2.05 seconds plus a 270ms fade once startup is
ready. Reduced Motion immediately renders the original logo without
decorative motion. Slow startup retains the loading note and retry control.
The launch animation plays once per app mount, not on every navigation.

`NearryAtmosphere` in `src/components/NearryAtmosphere.tsx`.
It uses only React Native primitives to build subtle warm-peach and ivory
curves, without image downloads or new native dependencies.

## Welcome and authentication

The welcome screen matches the accepted premium direction: centered original
Nearry identity with understated orbit, generous space, the heading
“Less scrolling. More living.”, a warm-orange Google button, and a pale
outlined Email button. The user can switch to login or enter the separate
business signup flow.

The **Play/Meet illustration cards, personal and business demo entry points,
and demo copy were removed from welcome**. No map pins, floating avatars,
made-up active plans, or unverified listings are displayed.

Google signup continues using the existing Supabase flow and **requires an
explicit 18+ terms/community-guidelines acceptance**. The Google button is
visually active at all times but shows the consent error if the checkbox
has not been accepted; it never bypasses the agreement. Email signup
continues to the existing form with its own explicit consent step.
Returning users can log in using existing credentials. Business signup
and the personal/business auth forms retain the original backend logic.
No authentication RPC, storage policies, or database migrations changed.

The admin-panel work is a separate PR and is not part of this branch.

## Builds and QA

Before rebuilding the Android/iOS native app, run `npm run assets` (requires
Pillow) to regenerate native splash files from the new orange-point frame.
Existing installed native splash artwork cannot be updated by an OTA
JavaScript bundle; install a freshly built app. Expo Go is not an accurate
representation of the installed native splash.

Verify a real Android cold start with and without a saved session; background
startup, offline/slow startup and retry; Google signup with checkbox
unchecked/checked; Email OTP; login and separate Business signup;
small screens with scroll and keyboard; Android large-font accessibility;
and reduced-motion settings. A passing CI build does not replace device QA.

The rest of the app's `LoadingState` skeletons and their error/retry behavior
remain as documented and unchanged.
