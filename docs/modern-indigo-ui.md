# Modern Indigo UI variant

Applies the supplied `nearry-modern-ui.patch` on a separate branch based on main.
The compact and screenshot-reference UI branches remain separate alternatives.

## Scope

- Indigo primary actions, ink text, cool neutral pages and white rounded cards.
- Platform system typography, soft elevation, pill filters and refreshed fields.
- Shared components carry the theme through Personal, Business, authentication,
  onboarding, details, messaging, settings and in-app dialogs.
- The approved logo geometry stays intact; native asset generation uses ink and
  amber with the matching page background. Rebuild the app to update native
  splash and launcher colours.
- Photos, eligibility checks, date/distance filters, navigation, requests,
  bookings and backend services retain the main branch's behaviour.

The patch needed an additional contrast correction: pale selected options in
profile editing, post editing, activity and venue amenities use dark indigo
labels. Account-menu counters use the same readable pairing. Filled rose unread
badges retain white text. The contrast test covers both pairings.

## Validation

- TypeScript and generated SQL checks.
- Full local test suite: 207 passed; six PostGIS/concurrency checks require the
  PostgreSQL service used in CI and are skipped locally.
- Android and web production bundle exports.
- Browser demo checks at phone widths: home, date filtering, activity, profile
  forms and business dashboard. No live account changes or production data writes.

Before merging, test the new branch on an Android phone with the keyboard open,
large text, image selection/cropping and both account types. Browser checks and
bundle exports do not replace a native device test.

No dependency installation beyond the existing lockfile and no Supabase
migration/deployment are required for this theme.
