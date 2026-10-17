import { verifyReviewToken, escapeHtml as esc } from "./reviewToken.ts";

function page(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{font-family:system-ui;background:#faf9f5;color:#252a26;max-width:640px;margin:40px auto;padding:24px}button{background:#c14d2f;color:white;border:0;padding:12px;margin:8px 0;cursor:pointer}img{max-width:100%}textarea{display:block;width:100%;box-sizing:border-box}form{margin-top:24px}</style></head><body><h1>${esc(title)}</h1>${body}</body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy":
          "default-src 'none'; img-src https:; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
// Dependency injection keeps the actual HTTP behavior testable without live keys.
export function createReviewHandler(db: any, secret: string) {
  return async (req: Request) => {
    if (!["GET", "POST"].includes(req.method))
      return new Response("method not allowed", { status: 405 });
    const form =
      req.method === "POST" ? await req.formData().catch(() => null) : null;
    const token =
      req.method === "POST"
        ? String(form?.get("token") ?? "")
        : (new URL(req.url).searchParams.get("token") ?? "");
    const signed = await verifyReviewToken(token, secret);
    if (!signed)
      return page(
        "Link invalid",
        "<p>This link is invalid or expired.</p>",
        403,
      );
    const { data: job, error: jobError } = await db
      .from("verification_review_jobs")
      .select("*")
      .eq("id", signed.review_id)
      .single();
    const { data: p, error } = await db
      .from("profiles")
      .select(
        "display_name,business_name,verification_status,verification_doc_path",
      )
      .eq("id", signed.user_id)
      .single();
    if (jobError || error)
      return page(
        "Review unavailable",
        "<p>Could not load this submission.</p>",
        503,
      );
    if (
      !job ||
      !p ||
      job.user_id !== signed.user_id ||
      job.document_path !== signed.document_path ||
      job.reviewed_at ||
      p.verification_status !== "pending" ||
      p.verification_doc_path !== signed.document_path
    )
      return page(
        "Review closed",
        "<p>This submission has already been reviewed or replaced.</p>",
        409,
      );
    if (req.method === "POST") {
      const decision = String(form?.get("decision") ?? ""),
        reason = String(form?.get("reason") ?? "").trim();
      if (!["approved", "rejected"].includes(decision) || reason.length > 200)
        return page(
          "Invalid decision",
          "<p>Choose approve or reject with a reason up to 200 characters.</p>",
          400,
        );
      const { error: reviewError } = await db.rpc("review_verification", {
        p_review_id: signed.review_id,
        p_decision: decision,
        p_reason: reason,
      });
      if (reviewError)
        return page(
          "Review not saved",
          "<p>The submission may have changed or already been reviewed. Refresh before trying again.</p>",
          409,
        );
      return page(
        "Review saved",
        `<p>${esc(p.business_name || p.display_name)}: ${esc(decision)}. The business has been notified in the app.</p>`,
      );
    }
    // GET is always read-only, including old links carrying ?decision=approved.
    const { data: document, error: documentError } = await db.storage
      .from("verification_docs")
      .createSignedUrl(signed.document_path, 300);
    if (documentError || !document)
      return page(
        "Document unavailable",
        "<p>Could not load the proof. Please try again later.</p>",
        503,
      );
    return page(
      `Review: ${p.business_name || p.display_name}`,
      `<p><a href="${esc(document.signedUrl)}" target="_blank" rel="noopener noreferrer">Open private document (expires in five minutes)</a></p><form method="post"><input type="hidden" name="token" value="${esc(token)}"><button name="decision" value="approved">Confirm approval</button><p>Or give a reason for rejection:</p><textarea name="reason" maxlength="200" rows="3"></textarea><button name="decision" value="rejected">Reject submission</button></form>`,
    );
  };
}
