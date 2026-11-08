# Google Places setup

The new app uses `place-autocomplete` for Search → Places and Nearby's area picker. Google returns up to five India-focused predictions while typing. Only choosing one fetches coordinates and the formatted address. The chosen prediction supplies the display name, so Details requests omit `displayName`, ratings and photos, which would change billing. A nearby coordinate biases results; without one the initial bias is Kakkanad/Kochi, not the server's IP. Other Indian locations are still searchable.

This feature does not add a map, import Google businesses into the database, verify business ownership, or add arbitrary external locations to post creation. Nearby activity still comes from Nearry's own geolocated venues. A valid external place can therefore have no Nearry plans yet.

## Setup and rollout

1. Open the existing [Nearry Google Cloud project](https://console.cloud.google.com/google/maps-apis/overview?project=nearry-43e80). Link/activate its billing account. The owner must handle payment information and accept any billing terms; free allowances still require billing.
2. Enable **Places API (New)** in that project. Maps JavaScript API, legacy Places, routing, ratings and photo APIs are not required for this implementation.
3. Create a dedicated server API key named **Nearry place search**. Restrict its API access to **Places API (New)** only. Do not reuse the Firebase/Google-sign-in key. Browser-referrer and Android-package restrictions do not work for calls from a Supabase edge worker. Use server IP restrictions only if fixed outbound IPs are available; ordinary edge workers do not supply a fixed client IP to allowlist.
4. Set conservative quotas for Autocomplete and Details in Cloud Console and billing alerts. Check the actual available quota controls and account usage. Alerts are notifications, not a spending cap. An optional initial application-side safeguard already limits requests as described below.
5. In **Nearry's Supabase project → Edge Functions → Secrets**, set `GOOGLE_PLACES_API_KEY` to this key and `PLACES_AUTOCOMPLETE_PROVIDER=google`. Do not put the key in chat, Git, Expo/EAS public variables or the APK. The operator should enter/copy it directly between the two service consoles.
6. Deploy the new function, if not already deployed:

   ```sh
   supabase functions deploy place-autocomplete --project-ref ggeejgykahzquynwighw --no-verify-jwt
   ```

   It calls Supabase `auth.getUser` on every non-preflight request. Gateway JWT verification is disabled consistently with the existing function; this does not remove its authentication or service-only quota enforcement. It uses the already-deployed migration `00019`, and needs no new SQL, scheduler or dispatch worker.

7. Republish Nearry's public Terms/Privacy pages from the updated source so Google Maps terms/privacy and search-data disclosure are available to users.
8. Merge this change and install a new Android build. Deploying the endpoint alone does not switch an older APK: its `place-search` call still uses Geoapify.
9. Sign in and test `Infopark`, `Kakkanad`, a local cafe, a turf and another Indian city. Confirm Google suggestions and attribution, choose one, check its actual area/coordinates, open Nearby and check radius filters. Test rapid typing, changing the query during selection, going back, empty results, a network failure and retry. Confirm only one Details call follows selection and inspect Cloud usage.

### Activation verified on 8 November 2026

- Places API (New) is enabled in `nearry-43e80`; live Google calls succeed after linking the Nearry billing account.
- Dedicated key **Nearry place search** is restricted to Places API (New). Its value is stored in Supabase secrets, alongside `PLACES_AUTOCOMPLETE_PROVIDER=google`; it is absent from app configuration and Git.
- `place-autocomplete` is deployed with explicit user authentication and existing service-only quota reservations. The legacy `place-search` endpoint is unchanged.
- Cloud Console confirmed **1,000 AutocompletePlacesRequest/day** and **1,000 GetPlaceRequest/day** for this project. These are shared testing limits, not a monetary cap or production capacity guarantee. Other APIs, billing-account projects and future quota changes can still produce charges. Billing alerts have not been configured.
- The actual provider adapter successfully fetched suggestions and selected-place coordinates for `Infopark`, `Kakkanad`, `cafe Kakkanad`, `Grand Hyatt Kochi` and `Indiranagar Bengaluru`. No response content was saved in the repository. The café result exposed Google's legitimate canonical Place ID change; resolution now accepts a validated canonical ID and binds the response to the selected prediction.
- Autocomplete predicts place names/addresses; it is not full categorical Google Maps search. A live `turf Kakkanad` query returned no suggestions. Specific venue names and areas are the intended input; broader category discovery requires a separate search feature.
- Remaining rollout: merge PR #35, republish legal pages, install a new Android build, and perform the signed-in phone checks above. Live adapter checks do not prove a phone-to-Edge authenticated round trip. Older APKs continue using Geoapify.

## Compatibility and rollback

The new endpoint chooses `PLACES_AUTOCOMPLETE_PROVIDER` if set; otherwise it selects Google when the Google secret exists, and Geoapify if only the legacy key exists. Google errors do not silently switch providers or return mock places. Set `PLACES_AUTOCOMPLETE_PROVIDER=geoapify` to roll a new build back to the existing provider. No app rebuild is required for that provider switch. Leave `GEOAPIFY_API_KEY` and the old `place-search` function in place while older phone builds remain installed. Do not change the legacy `PLACES_PROVIDER` setting as part of this rollout.

## Usage, sessions and stored content

- Typing waits 450 ms and cancels obsolete client requests. A session UUID is kept for a search, carried to the selected Details request, and rotated after selection, clearing, closing or 150 seconds. All calls use the same server Google key/project.
- No Details request is sent for suggestions that the person never selects. Abandoned sessions can still incur Autocomplete request charges.
- The field mask for Details is `id,location,formattedAddress,attributions`; the prediction already contains the selected name. This uses Essentials rather than Pro fields. Do not replace the mask with `*`.
- The new endpoint does not cache Google responses, share session tokens, log queries, persist searched coordinates or import predictions into tables. Results stay in transient screen/navigation state. Selected coordinates are used to query Nearry content; no third-party map is displayed. Place IDs are external IDs, never Nearry venue IDs.
- Google Maps attribution appears beside suggestions and selected locations; extra source attribution from Details is preserved. The narrow caption uses the permitted Google Maps text attribution with neutral 14sp text. Geoapify/OSM attribution remains when that provider is configured.
- Every upstream attempt, including selected Details, uses the existing shared `reserve_place_search` counters: 2,800/day and 4/second globally, 150/day and 20/minute per user. The new endpoint has no provider cache; these are conservative testing controls, not a 1,000-concurrent-user production design. Cloud Console additionally limits each used Google method to 1,000/day as verified above. The application cap alone does not guarantee staying under a monthly Google allowance (31 × 2,800 exceeds 70,000). Other keys/projects sharing the billing account also count.
- Existing search access remains signed-in only. Server errors never return Google URLs, keys or billing-account diagnostic payloads to clients.

## Free allowance and references

As checked on 8 November 2026, eligible India billing accounts have 70,000 Autocomplete requests and 70,000 Place Details Essentials requests free per month, per SKU. Eligibility requires Indian billing and a large majority of usage in India. These are monthly billable events, not people or complete search journeys, and are aggregated across linked projects. Beyond them, charges apply; request fields/session behavior affect the SKU.

- [India prices](https://developers.google.com/maps/billing-and-pricing/pricing-india)
- [India eligibility](https://developers.google.com/maps/billing-and-pricing/india)
- [Autocomplete and session pricing](https://developers.google.com/maps/documentation/places/web-service/session-pricing)
- [Place Details fields](https://developers.google.com/maps/documentation/places/web-service/place-details)
- [Display/storage and attribution requirements](https://developers.google.com/maps/documentation/places/web-service/policies?hl=en)

## Verification

Tests use fake Google HTTP responses and Supabase boundaries, never live credentials. They cover one Autocomplete request without prefetching Details; India/location bias; shared session token; exact Essentials field mask; empty and malformed responses; identity/coordinate checks; preserved attribution; authentication and quotas before upstream access; no response caching; failure redaction; client selection resolution; and compatibility with coordinate-complete Geoapify results.
