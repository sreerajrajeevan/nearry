# Shared plan links

Sharing a plan sends its title, time, place and a link.

- **Without setup**, the link is the Play Store listing
  (`https://play.google.com/store/apps/details?id=com.nearry.app`). It works
  for people who can see the listing: testers during closed testing, everyone
  once it's public.
- **With setup**, the link opens that exact plan in the app, and sends people
  without the app to the Play Store.

## Setup (once)

1. `npm run legal:export` now also writes `open.html`. Upload it next to the
   policy pages you already host (for example
   `https://nearry-support.dark-wasp-5372.chatgpt.site/open.html`).
2. GitHub → Settings → Secrets and variables → Actions → **Variables** → New:
   `EXPO_PUBLIC_SHARE_URL` = that page's full https address. For EAS builds,
   add the same EAS environment variable.
3. Build a new APK/AAB. Shared plans now link to
   `…/open.html?plan=<id>`.

Tapping the link on Android opens Nearry on the plan (`nearry://plan/<id>`,
already registered by the app's `nearry` scheme). If Nearry isn't installed,
the page falls back to the Play Store.

Later, with your own domain, Android App Links can make the https link open
the app directly, without the page.
