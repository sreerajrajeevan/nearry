# Bright Nearry onboarding

The approved interactive design is implemented on top of merged PR #41. The scope is welcome, introductions, Google/email authentication, account-type confirmation, Personal and Business setup, profile-completion recovery and the completion screen. The existing main app theme is unchanged.

## Flow

- Personal/Business is the first choice. Three short orange, green and blue introductions explain nearby plans, joining and offers. Back, Skip and login remain available.
- Existing Google OAuth and email OTP services, cooldowns, duplicate-request locks, error recovery and explicit signup consent are retained. No password or phone number is collected. Name is now collected after authentication for both providers.
- Personal setup collects optional profile photo, name, date of birth, gender, interests, optional availability and area/radius. A native birthday picker is used on Android/iOS; the web review uses labelled numeric fields. Only the calculated adult age is sent to the existing server eligibility checks; the full birthday stays in component memory and is discarded on unmount.
- Personal users can browse before finishing. Creating/joining still requires the existing complete adult profile. The completion flow invoked from a plan returns to that plan after saving. Existing completed accounts are not forced through setup again.
- Business setup saves the owner/contact name, business name/category and area, then opens the dashboard. This does not verify a business or enable unverified publishing.
- Real location permission is requested only after tapping the location button. Google place predictions resolve after selection. Business may explicitly confirm an area name when search succeeds with no results; this has no coordinates. Personal discovery never pretends a typed, unselected area has a distance.

## Data and discovery

Apply **only** `supabase/migrations/00035_bright_onboarding.sql` to an existing project before installing the new app. `supabase/run-all.sql` remains for fresh databases only.

The migration adds owner-only `onboarding_preferences` and the `finish_personal_onboarding` RPC. Name, age, gender, interests, consent and preferences are saved in one transaction through the existing account/age/terms checks. Invalid input or a failed final write rolls back the whole completion. Public profile reads cannot access availability or discovery coordinates. Existing administrator/verification permissions and existing records are preserved.

Availability is saved as a preference; it does not silently hide plans or promise automatic recommendations. The selected location and 2/5/10/25 km distance initialize Nearby's existing radius query. People can change area and filters in Nearby. Discovery coordinates expire after 29 days; the existing maintenance-retention worker also removes stale cached setup coordinates, including duplicated Google business coordinates. Existing background cleanup behavior is retained.

## Build and test

This change adds Expo-compatible `expo-linear-gradient`, `@react-native-community/datetimepicker` and `@react-native-community/slider`, and registers the birthday picker config plugin. **Create a fresh native build**; an over-the-air update cannot install new native modules into an older binary.

Validation includes TypeScript, the complete test suite, real-schema rollback/privacy/eligibility/retention tests, SQL bundle consistency, and production web/Android exports. Browser checks cover the actual welcome/introduction/auth UI and an isolated simulated-account review of the actual setup components; that review is outside the repository and never creates real users, sends codes or bypasses production auth.

Check the new phone build for keyboard/safe-area layout, native birthday picker and photo picker, location grant/deny, Google and email login, both account types, browse-first recovery from a plan, and saved discovery radius. Email sender/domain restrictions are unchanged by this UI work.
