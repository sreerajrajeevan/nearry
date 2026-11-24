# Shared plan links

Sharing a plan sends its title, time, place and a link.

- **Without setup**, the link is the Play Store listing
  (`https://play.google.com/store/apps/details?id=com.nearry.app`). It works
  for people who can see the listing: testers during closed testing, everyone
  once it's public.
- **With setup**, the link opens that exact plan in the app, and sends people
  without the app to the Play Store.

## Setup (once)

Builds now default to `https://sreerajrajeevan.github.io/nearry/open.html`
(in `eas.json` and the APK workflow). The page lives on the `gh-pages`
branch (`open.html` and `.nojekyll` only).

1. GitHub → the nearry repo → Settings → Pages → Build and deployment →
   **Deploy from a branch** → `gh-pages` / root → Save. This is the only
   manual step.
2. Build a new APK/AAB. Shared plans link to `…/open.html?plan=<id>`, and a
   venue's QR card links to `…/open.html?newplan=<venue id>`.

To host the page somewhere else, set the GitHub Actions variable (and EAS
environment variable) `EXPO_PUBLIC_SHARE_URL` to its full https address.
`npm run legal:export` also writes `open.html`.

## New-plan links

`?newplan=<venue id>` (printed as a QR by venues) opens "Short of players?":
on Android it opens Nearry straight on a new plan at that venue
(`nearry://new-plan?venue=<id>`) with "Players needed now" switched on, or the
Play Store if Nearry isn't installed.

Tapping the link on Android opens Nearry on the plan (`nearry://plan/<id>`,
already registered by the app's `nearry` scheme). If Nearry isn't installed,
the page falls back to the Play Store.

Later, with your own domain, Android App Links can make the https link open
the app directly, without the page.
