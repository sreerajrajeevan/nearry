# Reference discovery UI variant

Branch `feat/reference-discovery-ui` follows the supplied reference more closely. It is a separate alternative to PR #40; it includes that branch's theme baseline and does not modify its branch. Review one UI direction for merging. The older compact-discovery notes describe the other variant.

## Layout

Home uses the reference's charcoal search/filter control, four colourful category pills, two small side-by-side offer tiles, coral offer headlines and Claim labels. Fitness is selected initially when matching offers exist; otherwise All retains discoverability. See all makes all live offer categories available. Uploaded offer photos take priority over category artwork.

The plan filter row is All, Today, This week and Under 2 km. This week means the current Monday–Sunday calendar week, with past plans still excluded. The 2 km control retains the existing inclusive radius query and rounded distance labels. Without a selected location it opens the area picker. Existing filter/sort options and own-post exclusion are retained.

Plan cards have coloured host initials or the actual avatar, a compact square photo/artwork, pink Last spot badge, date/time/venue lines, audience/cost chips, approved-count progress, bookmark and Join controls. An Advanced/Intermediate/Beginner badge appears only when that tag exists. No host rating is fabricated. Actual uploaded plan photos are retained, with category artwork as fallback. A native-view fitness illustration supports plans with gym tags and no photo.

Join opens the existing plan details and request flow; it does not bypass profile completeness, audience restrictions or host approval. Claim opens the existing offer details and availability/booking flow. No new instant-redemption API is implied by the button label.

## Bookmarks

The bookmark is functional. Profile → Saved plans opens the shortlist. Only post IDs are stored locally on the device, scoped by account ID; bookmarks do not sync across devices. Saving does not persist photos, private messages or a snapshot of post content. Saved records are fetched again through existing authorized post reads whenever the saved screen gains focus; unavailable records are omitted. Unsave removes an ID from the shortlist. Writes are serialized and UI state changes only after persistence succeeds. Read/write errors are retryable and use the existing themed notices.

## Validation and release

TypeScript, the SQL bundle check, 24 targeted tests and production web/Android exports pass. Tests cover account isolation, bookmark persistence/concurrent toggles/error recovery, calendar-week boundaries, existing date/distance/sort logic, offer categorization and text contrast. Browser QA uses explicit demo fixtures and checks the saved list and the reference controls at phone sizes.

No new package, database migration or production data update is required. Existing demo fixtures alone include the reference-style gym examples. A real phone build still needs visual checks, particularly system text sizes and image/keyboard behaviour. Preview screenshots live outside Git under outputs/nearry-reference-ui.
