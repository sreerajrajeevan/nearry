import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createGeoapifyProvider } from "../_shared/geoapifyPlaces.ts";
import { createPlaceSearchHandler } from "../_shared/placeSearchHandler.ts";

const url = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const apiKey = Deno.env.get("GEOAPIFY_API_KEY");
// Provider selection lives on the server; a future Google adapter keeps this contract.
const providerName = Deno.env.get("PLACES_PROVIDER") ?? "geoapify";
const db =
  url && serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false } })
    : null;
const handler = createPlaceSearchHandler({
  provider:
    apiKey && providerName === "geoapify"
      ? createGeoapifyProvider(apiKey)
      : null,
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
});
serve(handler);
