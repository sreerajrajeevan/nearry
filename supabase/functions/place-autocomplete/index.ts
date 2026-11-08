import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createGooglePlacesProvider } from "../_shared/googlePlaces.ts";
import { createGeoapifyProvider } from "../_shared/geoapifyPlaces.ts";
import { createPlaceAutocompleteHandler } from "../_shared/placeAutocompleteHandler.ts";
import { validPlace } from "../_shared/placeTypes.ts";
import type { PlaceSuggestionProvider } from "../_shared/placeTypes.ts";
const url = Deno.env.get("SUPABASE_URL"),
  serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const db =
  url && serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false } })
    : null;
const googleKey = Deno.env.get("GOOGLE_PLACES_API_KEY"),
  geoKey = Deno.env.get("GEOAPIFY_API_KEY");
// Separate from legacy place-search: older phone builds keep their existing contract.
const providerName =
  Deno.env.get("PLACES_AUTOCOMPLETE_PROVIDER") ??
  (googleKey ? "google" : "geoapify");
let provider: PlaceSuggestionProvider | null = null;
if (providerName === "google" && googleKey)
  provider = createGooglePlacesProvider(googleKey);
else if (providerName === "geoapify" && geoKey) {
  const geo = createGeoapifyProvider(geoKey);
  provider = {
    id: geo.id,
    suggest: (q, b) => geo.search(q, b),
    async resolve(place) {
      if (!validPlace(place)) throw new Error("Invalid place");
      return place;
    },
  };
}
serve(
  createPlaceAutocompleteHandler({
    provider,
    async authenticate(authorization) {
      if (!db) return null;
      const { data, error } = await db.auth.getUser(authorization.slice(7));
      return error ? null : (data.user?.id ?? null);
    },
    async reserve(userId) {
      if (!db) return false;
      const { data, error } = await db.rpc("reserve_place_search", {
        p_user_id: userId,
      });
      if (error) throw new Error("Quota unavailable");
      return data === true;
    },
  }),
);
