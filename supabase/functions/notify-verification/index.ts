// Scheduled private worker. Submission only queues work; email failures never block it.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { signReviewToken, escapeHtml as esc } from "../_shared/reviewToken.ts";

serve(async (req) => {
  if (req.method !== "POST")
    return new Response("method not allowed", { status: 405 });
  const dispatchSecret = Deno.env.get("VERIFICATION_DISPATCH_SECRET");
  if (
    !dispatchSecret ||
    req.headers.get("x-dispatch-secret") !== dispatchSecret
  )
    return new Response("unauthorized", { status: 401 });
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const adminEmail = Deno.env.get("ADMIN_EMAIL");
  const reviewSecret = Deno.env.get("REVIEW_SECRET");
  const from = Deno.env.get("VERIFICATION_FROM_EMAIL");
  if (
    !url ||
    !serviceKey ||
    !resendKey ||
    !adminEmail ||
    !reviewSecret ||
    !from
  )
    return new Response("email not configured", { status: 503 });
  const db = createClient(url, serviceKey);
  const { data: jobs, error } = await db.rpc("claim_verification_jobs");
  if (error) return new Response("queue unavailable", { status: 503 });
  let sent = 0,
    failed = 0;
  for (const job of jobs ?? []) {
    try {
      const { data: p, error: profileError } = await db
        .from("profiles")
        .select(
          "display_name,business_name,verification_status,verification_doc_path",
        )
        .eq("id", job.user_id)
        .single();
      if (profileError || !p) throw new Error("profile unavailable");
      if (
        p.verification_status !== "pending" ||
        p.verification_doc_path !== job.document_path
      )
        continue;
      const token = await signReviewToken(
        {
          user_id: job.user_id,
          review_id: job.id,
          document_path: job.document_path,
          exp: new Date(job.created_at).getTime() + 7 * 86400000,
        },
        reviewSecret,
      );
      const reviewUrl = `${url}/functions/v1/review-verification?token=${encodeURIComponent(token)}`;
      const name = p.business_name || p.display_name;
      // Private document is viewed using a short-lived URL on the review page.
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [adminEmail],
          subject: `Verify business: ${name}`,
          html: `<h2>${esc(name)}</h2><p>A business document is ready for review.</p><p><a href="${esc(reviewUrl)}">Review submission</a></p><p>This link expires seven days after submission. Opening it does not approve the business.</p>`,
        }),
      });
      if (!response.ok)
        throw new Error(`email provider status ${response.status}`);
      const { error: saveError } = await db
        .from("verification_review_jobs")
        .update({ sent_at: new Date().toISOString(), last_error: null })
        .eq("id", job.id);
      if (saveError) throw new Error("delivery acknowledgement failed");
      sent++;
    } catch (e) {
      failed++;
      const { error: saveError } = await db
        .from("verification_review_jobs")
        .update({
          last_error: e instanceof Error ? e.message : "delivery failed",
        })
        .eq("id", job.id);
      if (saveError) console.error("verification job update failed");
    }
  }
  return Response.json({ sent, failed });
});
