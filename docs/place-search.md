# Place search

Nearry uses Geoapify autocomplete for **Search → Places** and the **Nearby area picker**. Selecting a suggestion opens a location preview with Nearry plans, offers and venues within 5 km. “Use this area in Nearby” sets that location as the feed's center without requesting GPS permission. A provider place is not a registered business and never becomes a venue UUID or claimed business automatically.

Current post creation still attaches a post to a Nearry venue. This change adds external location discovery; importing external venues or posting directly at an arbitrary external point is separate work. Nearby content currently comes from geolocated Nearry venues, so a searchable location can have no Nearry activity yet.

## Setup

1. Create a free Geoapify account and project at [Geoapify](https://myprojects.geoapify.com/). Use a dedicated key for this function. Local place coverage should be checked with actual searches such as Infopark, Kakkanad and relevant business names before rollout.
2. Apply only missing database migrations through `00019_place_search_limits.sql`. Existing projects on `00018` need just `00019`. Never replay `run-all.sql` on an existing project.
3. Put `GEOAPIFY_API_KEY` in **Supabase Edge Function secrets**, not `.env`, `EXPO_PUBLIC_*`, Git, or the app. Optional `PLACES_PROVIDER=geoapify` selects the current adapter. The Expo app only needs its existing Supabase URL and public key.
4. Deploy:

   ```sh
   supabase functions deploy place-search --no-verify-jwt
   ```

   This function performs its own authentication using `auth.getUser` for every non-preflight request. Disabling gateway JWT verification does not make the search public: only an actual signed-in user token is accepted. The service role key remains server-side.

5. Sign in to the real app, open Search, type at least three characters and select a result. Confirm Nearby centers on the selected location, GPS still works, and switching back to a manual area clears that center. Browser CORS preflight is supported.

No scheduler is needed. A missing key/function produces an explicit error while local Nearry search remains usable. Failed live search never silently returns demo fixtures. Welcome-screen demo mode has three explicitly labelled sample locations; it does not call Geoapify.

## Usage controls

Suggestions wait 450 ms after typing and cancel obsolete client requests. Each search returns at most five suggestions. The edge worker keeps up to 100 results in memory for five minutes and reuses an in-flight matching search within that instance. This is a short-lived cache; coordinates and raw search text are not persisted to the quota table or logged by this code.

Migration `00019` reserves usage atomically across edge instances before an upstream call. It caps this integration at 2,800 upstream attempts per UTC day, four per calendar second globally, 150 per user per UTC day, and 20 per user per minute. Cached responses do not use provider quota; a failed upstream attempt still uses the reserved allowance. Concurrent duplicate requests may reserve conservatively even if an in-flight request is subsequently reused. The counters keep at most two days of windows during active use. Inspect `place_search_usage` with an administrator/service role; clients cannot access it or bypass the RPC.

These limits help protect the free allowance; they do not control other uses of the same Geoapify account/key. Monitor provider usage and use a dedicated key/account budget. Provider throttling, outages and missing coverage can still return errors or no matches. The free plan's actual limits and terms are governed by [Geoapify pricing](https://www.geoapify.com/pricing/).

The screen displays linked Geoapify and OpenStreetMap attribution beside suggestions and selected locations, and preserves additional source attribution returned by Geoapify. No map tiles, directions, photos, opening hours or provider ratings are fetched.

## Switching providers later

The app consumes the normalized `Place` contract in `supabase/functions/_shared/placeTypes.ts`: provider, opaque ID, name, address, latitude, longitude and attribution. Provider-specific HTTP and mapping logic lives in `geoapifyPlaces.ts`. The server entry point selects the adapter; screens only call `searchPlaces` and use coordinates for discovery.

To add Google Places later, implement `PlaceProvider`, normalize its results/details into `Place`, wire server-side provider selection and secrets, and add its required attribution/session handling and tests. Review Google's current storage/display rules before enabling it. Setting `PLACES_PROVIDER=google` alone will not work until that adapter exists. Existing Nearry venue IDs, bookings and posts remain independent of external provider IDs.

## Checks

Automated tests cover provider mapping, malformed coordinates, query encoding, India filtering, longitude/latitude order, required attribution, authentication, validation, missing configuration, quota errors, cache expiry/bias separation, error redaction, the app-to-function contract, and swapping in another provider. Database tests verify that quota counters/RPCs are private and the shared ceiling is enforced. CI runs the full database suite and Android/web exports.

Live Geoapify requests, exact Infopark coverage, and deployed Supabase authentication/configuration require the key and staging deployment. No live key is bundled or used by the automated fixtures.
