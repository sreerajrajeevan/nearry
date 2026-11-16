import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPremiumHandler } from "../_shared/premiumHandler.ts";

serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const webhookSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  const revenueCatKey = Deno.env.get("REVENUECAT_API_KEY");
  if (!url || !key || !webhookSecret || !revenueCatKey)
    return new Response("Premium unavailable", { status: 503 });
  return createPremiumHandler({
    db: createClient(url, key),
    webhookSecret,
    revenueCatKey,
    fetch,
  })(req);
});
