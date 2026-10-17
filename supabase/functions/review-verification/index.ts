import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createReviewHandler } from "../_shared/reviewHandler.ts";

serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const secret = Deno.env.get("REVIEW_SECRET");
  if (!url || !key || !secret)
    return new Response("Review unavailable", { status: 503 });
  return createReviewHandler(createClient(url, key), secret)(req);
});
