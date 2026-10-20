# Around You branding and loading

The approved logo is now used in personal/business headers, the welcome and auth
headers, the React launch reveal, and the generated launcher/splash/favicon assets.

## Launch

`App.tsx` holds the native splash while bundled artwork and the icon font load, then
hands over to `StartupSplash`. The pin settles, the orange nearby point arrives and
the wordmark brightens. The ready app fades in after the short 620ms reveal plus 180ms
exit. Reduced motion skips those animations and delays. Session/profile errors can
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
