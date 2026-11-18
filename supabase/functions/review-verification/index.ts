import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createReviewHandler } from "../_shared/reviewHandler.ts";
serve((req) =>
  createReviewHandler(null, "", Deno.env.get("ADMIN_CONSOLE_URL"))(req),
);
