# Meeting-place search and nearby plans

Search, area selection and the post place field have an explicit cross button on Android, iOS and web. Clearing calls the same controlled query setter, so old suggestions are cancelled and the field stays usable with the keyboard open.

Create and Edit Post now share `PostLocationField`:

- Search registered Nearry venues and Google place predictions. Resolving coordinates happens only after a prediction is selected, using the existing authenticated endpoint, session and quotas.
- The selected Google name/address and required attribution are displayed transiently. The public plan stores the host's independently entered meeting label, provider ID and coordinates; it does not add a fake venue or verified business. The host can edit the label.
- “Can’t find it? Add a location” accepts a name plus latitude/longitude, or explicitly requested device location. Device location is appropriate only when the host is at the meeting spot. A name without coordinates is never treated as an exact position. Permission denial, no results and provider errors leave this option usable.
- Unselected search text blocks publishing until the host selects a location, confirms manual coordinates or, when editing an older plan, clears its optional field. New posts must have a registered venue or a named spot with confirmed coordinates. Location changes and removal are saved by Edit Post. Existing registered venue selections remain supported.

## Required venue for new posts

New posts show **Meeting place \***. Publishing rejects a missing selection or a typed name without confirmed coordinates, both in the app/service and at the database INSERT boundary. Apply `00032_require_post_meeting_place.sql` after `00031`. Existing posts are preserved; no historical rows are rewritten or deleted, and existing edit/cancel/retention behavior remains available.

## Database rollout

Apply only migration `00031_post_meeting_locations.sql` to the existing database before installing the new app. `supabase/run-all.sql` is for fresh databases only. No new Google key or API is needed. Existing clients keep working because all new fields are optional.

The migration appends location fields to the `post_cards` read model, retains invoker/RLS behavior and enforces coordinate ranges and host-only changes. A location-only edit cannot change a closed or past plan. External coordinates cannot claim a registered venue ID. `nearby_post_cards` returns visible, upcoming, open posts within the selected radius, including posts without a registered venue. Legacy posts use their registered venue's location. The app uses the returned distance for distance chips and sorting; unknown locations do not count as nearby. Directions uses the chosen coordinates.

Google coordinates are a temporary cache: they are masked from reads after 29 days and removed by the existing five-minute `account-maintenance` worker's retention cleanup. Google place IDs and host-authored labels remain. Users cannot set or extend the cache timestamp. Plans whose Google coordinate cache has expired need a fresh place selection in Edit Post before they appear in coordinate-based discovery again; manual coordinates do not expire. Monitor the maintenance worker, and do not remove its existing schedule. No new deletion schedule is introduced.

References: [Places policy](https://developers.google.com/maps/documentation/places/web-service/policies), [service terms and coordinate-cache exception](https://cloud.google.com/maps-platform/terms/maps-service-terms).

## Validation

Service tests cover coordinate creation, read mapping, moving/removing a spot, the location RPC and distances without any registered venue IDs. Database tests cover grants, cross-account writes, invalid coordinates, server-owned cache timestamps and retention. Real PostGIS tests cover radius exclusion, legacy fallback and blocked-host visibility. Manual-coordinate tests reject blanks, malformed strings, out-of-range and non-finite values, while accepting valid zero/negative coordinates. Existing Today/weekend/category/audience filters remain in the same discovery pipeline.
