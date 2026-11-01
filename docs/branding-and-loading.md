# Around You branding and loading

The approved logo is now used in personal/business headers, the welcome and auth
headers, the React launch reveal, and the generated launcher/splash/favicon assets.

## Launch

`App.tsx` holds the native splash while bundled artwork and the icon font load, then
hands over to `StartupSplash`. the opening sequence tells an original Nearry story:
the burnt-orange nearby point appears, expands into an abstract globe made
from curved parallels and meridians **without countries or real geography**,
pushes in toward a destination ripple, and resolves into the approved
Around You pin and exact original wordmark. The artwork in
`assets/brand/pin.png` and `wordmark.png` is reused directly, with no
new Nearry mark. The ready app fades in after the ~1.84s story plus 230ms exit.
The story animation runs once per app mount, not after every navigation.
 Reduced motion skips those animations and delays. Session/profile errors can
reach their existing retry/sign-out UI rather than waiting for a navigator's
`onReady` event. The launch reveal runs once per app mount, not after every login or
profile refresh. Slow startup shows a connection hint and retry after 12 seconds.

The system accessibility preference defaults to reduced motion while it is checked.
A bounded preference check keeps an unavailable accessibility API from holding launch.
Loading loops stop when a screen blurs, the app backgrounds or reduced motion is on.

Android 12+ masks its native splash image, so its pin-only frame omits the wordmark;
iOS uses the complete composition. The React frame uses the same position/scale.
The source images are transparent, with a warm-white native splash background.

## Loading states

`LoadingState` supplies list, detail, compact and inline layouts. Initial content
shows softly pulsing placeholders and a contextual label. Error/retry and empty
states stay separate. After 12 seconds, a connection hint explains a long wait.
The placeholders are excluded from the accessibility tree and progress is named.

Nearby, search, place/venue/post/offer details, edit forms, personal activity/my posts,
business dashboard/bookings/my offers, chat, notifications, blocked accounts,
report history and notification settings use this shared state. Button actions keep
their label, disable repeat presses and show shared loading dots. Place suggestions
use the compact inline treatment. Cover and gallery photos reserve their space and
show dots while loading; each caller retains its existing error fallback.

The shared live-query hook keeps existing results visible on repeat focus/refresh.
A changed query/account key clears them as before. Pull-to-refresh and background
refresh use the screen's existing controls rather than a full-screen overlay.

## Assets and builds

Run `npm run assets` with Pillow installed before prebuild/export. The generator
uses committed `assets/brand/pin.png` and `wordmark.png`; it will not restore the old
speech-bubble assets. Their editable SVG originals and export sizes are documented
in `assets/brand/README.md`. CI already runs generation before building the APK.

Install/rebuild the native app to see the launcher and native splash changes.
An over-the-air JavaScript update or Expo Go cannot replace the installed launcher
artwork or fully reproduce the standalone native splash. Check the new APK on both
Android and iOS when available, including reduced motion, a cold launch with a saved
session, a failed/offline profile request, uploads and a slow first content load.

No database migration or Supabase configuration change is required for this change.

## Welcome and authentication

`WelcomeScreen` uses two of Nearry's existing original category-scene
illustrations, labelled Play and Meet. No profile-map pins, claimed nearby
users, actual map coordinates, ad inventory, or inferred live plan listings
appear before login. The tiles have subtle motion that stops when the screen
is not focused and is disabled by Reduce Motion. All demo entrances are
explicitly marked as sample content.

The Google action is wired to the **existing** Supabase Google signup path,
requiring the explicit 18+ Terms/Community Guidelines checkbox first.
Email continues to Personal signup (where the agreement is separately
checked); returning people can use the visible Log in link. Local businesses
have a distinct Business signup action and both Personal and Business demo
links remain available. Backend setup and legal links keep their existing
behavior. Authentication internals and database contracts are not changed.

Before shipping, verify on smaller Android phones with large font scaling
and the keyboard open, Google signup consent, returning Google login,
email OTP, account-type routing, both demo modes and offline backend errors.
An `npm run typecheck`/export check cannot replace those device tests.
