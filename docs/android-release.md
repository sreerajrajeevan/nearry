# Android release setup

The app uses Expo SDK 54 / React Native 0.81, Android target/compile API 36 and the New Architecture. It keeps the warm-white, ink and clay design. Android now draws edge to edge; screens and the tab bar reserve safe areas. Test both gesture navigation and three-button navigation on a phone.

## Two separate build paths

- **Phone testing:** the existing GitHub workflow still publishes `app-debug.apk` to the `debug-latest` release. It bundles JavaScript and uses the committed throwaway debug key so test updates install consistently.
- **Google Play:** EAS `production` builds an **AAB**, uses a private remote upload key and increments the Android build number remotely. The debug key is removed from the generated release signing configuration. A native build outside EAS is unsigned until you configure private signing. Never upload the shared debug key to EAS or Play.

The old development-client profile was removed because this app does not install `expo-dev-client`. Use the standalone preview APK or the normal Expo development server.

## 1. Link your Expo project

Create/select the Nearry project in your Expo account. Copy its project UUID from project settings into local `.env` as `EXPO_PUBLIC_EAS_PROJECT_ID`. If you already registered `com.nearry.app` in Play, keep its existing upload key and choose that key during EAS credential setup. Do not generate a replacement key for an existing Play app without following Play's key-reset process.

`app.config.js` passes that same UUID to EAS so builds and push registration use one project. If EAS initialization adds an ID to `app.json`, keep it identical to the environment variable. Keep the existing Android package `com.nearry.app`.

Log in from your own terminal:

```sh
npx eas-cli login
```

## 2. Set production public configuration

Fill all five variables from `.env.example` locally and in the Expo dashboard's **production** environment:

| Variable | Value |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Real HTTPS Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon JWT or publishable key |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | Expo project UUID |
| `EXPO_PUBLIC_LEGAL_OWNER` | Actual app operator's name |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | Monitored support/privacy email |

These are embedded in the app. Use plain-text or sensitive visibility in EAS, not secret visibility for values needed during local app-config evaluation. Never put a service-role key, Geoapify key, FCM service-account JSON or keystore password in `EXPO_PUBLIC_*`. Provider/server secrets stay in Supabase; Android push credentials belong in EAS credentials. Configure Android FCM v1 credentials for this Expo project before testing remote push.

For Android push, register `com.nearry.app` in Firebase and download its Android **google-services.json**. Set local `GOOGLE_SERVICES_JSON` to its absolute file path, and upload the same JSON as an EAS **File** environment variable named `GOOGLE_SERVICES_JSON` in production. The app config includes it during prebuild. This Android client configuration is separate from the FCM v1 **service-account private key**, which you configure using `npx eas-cli credentials --platform android`. Both are needed for remote push; never commit the private key. Production preflight checks that the Android configuration belongs to the correct package.

## 3. Prepare and validate

```sh
npm ci
python3 -m pip install pillow
npm run assets
npm run release:check
npm run typecheck
npm test
npx expo-doctor
```

Use Python with Pillow installed if your system manages Python packages externally. Six generated launcher/splash images must exist before EAS upload. `.easignore` includes them even though Git ignores them. The EAS post-install hook repeats release validation on the builder and stops a production build with missing/placeholder public settings or a private backend key.

The initial display version remains `0.1.0`. Decide the public display version in `app.json` before the first release. EAS manages `versionCode` remotely; if Play already has an uploaded build, initialize EAS's Android version above that build using `npx eas-cli build:version:set` before building.

## 4. Build and install through Play internal testing

```sh
npx eas-cli build --platform android --profile production
```

On the first build, EAS asks for the Android upload keystore. Use the existing key for an existing Play app; for a new app, allow EAS to generate a private one and securely back it up through EAS credentials. This is an account-owner step. The repository contains no private upload key and does not automatically create credentials or submit to Play.

Download the signed AAB from the completed EAS build. Upload it to **Play Console → Testing → Internal testing** with Play App Signing, add testers and install from the testing link. An AAB cannot be installed directly like an APK. The Play-signed app cannot update an installed debug APK with the same package; uninstall the debug app first or use a separate test device. Uninstalling clears local drafts and sessions.

For standalone testing before Play, use `npx eas-cli build --platform android --profile preview`. Preview uses the separate EAS preview environment and is not a store release.

## What CI proves

Core checks run TypeScript, app/service tests, disposable PostgreSQL/PostGIS tests and Android/web bundle exports. The Android release job compiles an **unsigned** release APK and AAB for arm64/x86_64. It checks target SDK 36, non-debuggable manifest, absence of broad media/audio/background-location permissions, absence of a release signature, APK ZIP alignment and all 64-bit ELF load-segment alignments. It does not publish these unsigned outputs or request private credentials.

The image picker uses the system's selected-photo access, not broad library access. Camera/audio and background location are not app features and are excluded. Verify photo selection/upload and foreground location after the upgrade.

## Checks still required before going live

Install the signed build on actual phones and run [the core journey checklist](core-journey-checklist.md) for both account types. Include Google and email redirects, photo/proof upload, keyboard, tab labels/safe areas, blocked contacts, report submission, deletion cleanup, notification permission/delivery and notification taps from a closed app. Test a 16 KB Android emulator/device as well as normal phones; static alignment checks alone do not prove runtime compatibility.

Confirm live Supabase migrations/functions/schedules and moderation/deletion workers using [the safety rollout guide](account-safety-rollout.md). No production database is changed by these build scripts. Merge the separate signup-agreement fix before the public release. Publish reviewed privacy/account-deletion pages with real contacts, then complete Play's store listing, App access, Data safety, content rating, ads/target-audience declarations and any testing requirement shown for your developer account. A successful build alone does not make Nearry production-ready.

Reference: [Expo SDK 54 changes](https://expo.dev/changelog/sdk-54), [EAS Android build/signing lifecycle](https://docs.expo.dev/build-reference/android-builds/), [EAS version management](https://docs.expo.dev/build-reference/app-versions/), [Android page-size guidance](https://developer.android.com/guide/practices/page-sizes).
