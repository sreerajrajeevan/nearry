import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0";
import { createAdminConsoleHandler } from "../_shared/adminConsole.ts";

const url = Deno.env.get("SUPABASE_URL");
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const origins = Deno.env.get("ADMIN_ALLOWED_ORIGINS");
if (!url || !key || !origins) {
  serve(() => new Response("Admin console not configured", { status: 503 }));
} else {
  serve(
    createAdminConsoleHandler(
      createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
      origins,
      url,
    ),
  );
}
