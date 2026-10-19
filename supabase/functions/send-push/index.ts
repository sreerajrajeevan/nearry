import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPushHandler } from "../_shared/pushHandler.ts";
const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
serve(
  createPushHandler(
    db,
    Deno.env.get("PUSH_DISPATCH_SECRET"),
    fetch,
    Deno.env.get("EXPO_ACCESS_TOKEN"),
  ),
);
