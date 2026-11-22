# Distance on plan and offer cards

Plan cards, starting-soon cards, offer cards and Spotlight show a separate location row. Photos, join/book actions and the selected discovery area are preserved.

- With foreground location permission already granted, cards measure from a fresh device position: “About 2.4 km away”. Reading card distances never opens a permission prompt.
- Otherwise the selected Home area (or onboarding area) is used and named: “About 2.4 km from Kakkanad”. A saved GPS position is labelled “from last location” until refreshed.
- With no usable origin or destination, the place name stays visible and the numeric distance is omitted. Missing coordinates are never treated as zero. Demo distances are labelled as samples.
- Values are approximate straight-line distances, calculated on the device. They are not road distances or travel times. Directions remains the route-planning action.

`CardDistanceProvider` shares one quiet position read on session/foreground/refresh, discards old account responses, and batches public venue coordinate reads (up to 100 IDs per query). Those queries send venue IDs, not the viewer's coordinates. Existing Home search requests retain their existing location behavior. Venue lookup failures leave cards usable and retry on refresh/foreground.

No migration or new API key is required. Business venues use the public `location_lat` and `location_lng` columns from migration 00044. Legacy venues without those columns populated can use Home's existing nearby-query distance, labelled with the original query area; other screens omit a distance they cannot establish. Search filters and sorting continue to use the selected discovery area.

Regression coverage: `tests/cardDistance.test.ts` checks origins, stale query hints, missing/invalid points, zero coordinates, antipodes/date-line calculations and bounded public venue queries. Phone GPS permission and background/resume behavior should also be smoke-tested in the Android build.
