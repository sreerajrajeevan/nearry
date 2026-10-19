import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAccountMaintenanceHandler } from "../_shared/accountMaintenance.ts";
const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
serve(
  createAccountMaintenanceHandler(
    db,
    Deno.env.get("ACCOUNT_MAINTENANCE_SECRET"),
  ),
);
