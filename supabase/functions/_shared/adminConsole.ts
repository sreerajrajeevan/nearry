/** Every operation validates the Supabase session, private allowlist and MFA. */
type Db = any;
const SECTIONS = new Set([
  "overview",
  "business",
  "selfies",
  "reports",
  "users",
  "plans",
  "offers",
  "bookings",
  "operations",
  "audit",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 25;
const columns: Record<string, string> = {
  reports:
    "id,subject_user_id,target_kind,target_id,reason,details,snapshot,status,created_at",
  users:
    "id,account_type,display_name,business_name,verification_status,onboarding_completed,created_at,suspended_at,deletion_requested_at",
  plans:
    "id,author_id,title,status,starts_at,venue_name,vacancies,gender_preference,created_at",
  offers: "id,business_id,title,status,starts_at,ends_at,created_at",
  bookings: "id,offer_id,customer_id,status,slot,party_size,created_at",
  audit: "id,actor_id,action,target_id,note,created_at",
};
function checked<T>(result: {
  data: T;
  error?: { message: string } | null;
}): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
function json(body: unknown, status: number, origin: string | null) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] =
      "authorization, content-type, apikey, x-client-info";
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  }
  return new Response(JSON.stringify(body), { status, headers });
}
async function list(db: Db, section: string, offset: number) {
  if (section === "overview")
    return { metrics: checked(await db.rpc("admin_console_overview")) };
  if (section === "operations") {
    const [deletions, media, push] = await Promise.all([
      db
        .from("account_deletion_jobs")
        .select("user_id,requested_at,attempts,next_attempt_at,last_error")
        .order("requested_at", { ascending: false })
        .limit(25),
      db
        .from("media_cleanup_jobs")
        .select("id,bucket,path,attempts,next_attempt_at,last_error")
        .order("next_attempt_at", { ascending: false })
        .limit(25),
      db
        .from("push_jobs")
        .select("id,attempts,next_attempt_at,last_error")
        .is("sent_at", null)
        .order("next_attempt_at", { ascending: true })
        .limit(25),
    ]);
    return {
      operations: {
        deletions: checked(deletions),
        media: checked(media),
        push: checked(push),
      },
    };
  }
  let rows: any[];
  if (section === "business" || section === "selfies") {
    rows = checked(
      await db.rpc(
        section === "selfies"
          ? "admin_console_selfie_queue"
          : "admin_console_business_queue",
        {
          p_offset: offset,
          p_limit: PAGE_SIZE + 1,
        },
      ),
    );
  } else {
    const source: Record<string, string> = {
      reports: "content_reports",
      users: "profiles",
      plans: "posts",
      offers: "offers",
      bookings: "bookings",
      audit: "admin_console_audit",
    };
    let q = db
      .from(source[section])
      .select(columns[section])
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (section === "reports") q = q.eq("status", "open");
    rows = checked(await q.range(offset, offset + PAGE_SIZE));
    if (section === "reports") {
      const ids = [
        ...new Set(rows.map((r) => r.subject_user_id).filter(Boolean)),
      ];
      const people: any[] = ids.length
        ? checked(
            await db
              .from("profiles")
              .select("id,display_name,business_name")
              .in("id", ids),
          )
        : [];
      rows = rows.map(({ snapshot, ...r }) => ({
        ...r,
        evidence: snapshot,
        subject:
          people.find((p) => p.id === r.subject_user_id)?.business_name ||
          people.find((p) => p.id === r.subject_user_id)?.display_name ||
          "Member",
      }));
    }
  }
  return {
    rows: rows.slice(0, PAGE_SIZE),
    hasMore: rows.length > PAGE_SIZE,
    offset,
  };
}
export function createAdminConsoleHandler(
  db: Db,
  allowedOrigins: string | undefined,
  supabaseUrl?: string,
) {
  // Only our own immutable avatar objects may be used for a comparison.
  // Never fetch or render an arbitrary URL supplied through profile metadata.
  async function selfieComparison(id: string) {
    const review = checked<any>(
      await db
        .from("personal_selfie_reviews")
        .select(
          "user_id,submission_id,selfie_path,avatar_path,avatar_url_at_submission,status,submitted_at",
        )
        .eq("submission_id", id)
        .maybeSingle(),
    );
    if (
      !review ||
      review.submission_id !== id ||
      review.status !== "pending" ||
      !Number.isFinite(Date.parse(review.submitted_at)) ||
      Date.parse(review.submitted_at) <= Date.now() - 7 * 86400000 ||
      typeof review.selfie_path !== "string" ||
      !review.selfie_path.startsWith(review.user_id + "/selfie-")
    )
      throw new Error(
        "Review unavailable, expired or changed; refresh the queue",
      );
    const profile = checked<any>(
      await db
        .from("profiles")
        .select("id,account_type,avatar_url,suspended_at,deletion_requested_at")
        .eq("id", review.user_id)
        .maybeSingle(),
    );
    if (
      !profile ||
      profile.account_type !== "personal" ||
      profile.suspended_at ||
      profile.deletion_requested_at ||
      !profile.avatar_url ||
      profile.avatar_url !== review.avatar_url_at_submission ||
      typeof review.avatar_path !== "string" ||
      !UUID.test(review.user_id) ||
      !review.avatar_path.startsWith(review.user_id + "/") ||
      !/^[a-zA-Z0-9._-]+$/.test(review.avatar_path.slice(37))
    )
      throw new Error("Review unavailable or changed; refresh the queue");
    const base = new URL(supabaseUrl || "https://invalid.local");
    const avatar = new URL(profile.avatar_url);
    const path = "/storage/v1/object/public/avatars/" + review.avatar_path;
    if (
      !supabaseUrl ||
      base.protocol !== "https:" ||
      avatar.origin !== base.origin ||
      avatar.pathname !== path ||
      avatar.username ||
      avatar.password
    )
      throw new Error(
        "Review unavailable: upload a profile photo in Nearry first",
      );
    return { review, avatarUrl: base.origin + path };
  }
  const allowed = new Set(
    (allowedOrigins ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => /^https:\/\//.test(x)),
  );
  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get("Origin");
    if (!allowed.size)
      return json({ error: "Admin origin is not configured" }, 503, null);
    if (origin && !allowed.has(origin))
      return json({ error: "Origin not allowed" }, 403, null);
    if (req.method === "OPTIONS")
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin ?? "",
          "Access-Control-Allow-Headers":
            "authorization, content-type, apikey, x-client-info",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Max-Age": "600",
          Vary: "Origin",
        },
      });
    if (req.method !== "POST")
      return json({ error: "Method not allowed" }, 405, origin);
    const token = /^Bearer (.+)$/i.exec(
      req.headers.get("Authorization") || "",
    )?.[1];
    if (!token || token.length > 12000)
      return json({ error: "Sign in required" }, 401, origin);
    try {
      const auth = await db.auth.getUser(token);
      const user = auth?.data?.user;
      if (
        auth.error ||
        !user?.id ||
        !UUID.test(user.id) ||
        !user.email_confirmed_at
      )
        return json({ error: "Invalid or unconfirmed session" }, 401, origin);
      const member = await db
        .from("admin_console_members")
        .select("role")
        .eq("user_id", user.id)
        .is("revoked_at", null)
        .maybeSingle();
      if (member.error)
        return json({ error: "Admin membership unavailable" }, 503, origin);
      if (!member.data || !["owner", "moderator"].includes(member.data.role))
        return json(
          { error: "Not an authorized Nearry administrator" },
          403,
          origin,
        );
      const profile = checked<any>(
        await db
          .from("profiles")
          .select("id,suspended_at,deletion_requested_at")
          .eq("id", user.id)
          .maybeSingle(),
      );
      if (!profile || profile.suspended_at || profile.deletion_requested_at)
        return json(
          { error: "Administrator account is inactive" },
          403,
          origin,
        );
      if (Number(req.headers.get("Content-Length") || 0) > 16384)
        return json({ error: "Request too large" }, 413, origin);
      const text = await req.text();
      if (text.length > 16384)
        return json({ error: "Request too large" }, 413, origin);
      let payload: any;
      try {
        payload = JSON.parse(text);
      } catch {
        return json({ error: "Invalid request" }, 400, origin);
      }
      if (!payload || typeof payload !== "object" || Array.isArray(payload))
        return json({ error: "Invalid request" }, 400, origin);
      const assurance = await db.auth.mfa.getAuthenticatorAssuranceLevel(token);
      if (assurance.error)
        return json({ error: "Session verification unavailable" }, 401, origin);
      const mfaRequired = assurance.data?.currentLevel !== "aal2";
      if (payload.action === "status")
        return json({ role: member.data.role, mfaRequired }, 200, origin);
      if (mfaRequired)
        return json(
          {
            error: "Authenticator verification required",
            code: "mfa_required",
          },
          403,
          origin,
        );
      if (payload.action === "list") {
        if (!SECTIONS.has(payload.section))
          return json({ error: "Invalid section" }, 400, origin);
        const offset = payload.offset ?? 0;
        if (!Number.isSafeInteger(offset) || offset < 0 || offset > 5000)
          return json({ error: "Invalid page" }, 400, origin);
        return json(await list(db, payload.section, offset), 200, origin);
      }
      if (payload.action === "proof") {
        if (!UUID.test(payload.id ?? ""))
          return json({ error: "Invalid review ID" }, 400, origin);
        if (payload.kind === "selfie") {
          const { review, avatarUrl } = await selfieComparison(payload.id);
          const signed = checked<any>(
            await db.storage
              .from("selfie_proofs")
              .createSignedUrl(review.selfie_path, 60),
          );
          return json(
            { url: signed.signedUrl, avatarUrl, expiresIn: 60 },
            200,
            origin,
          );
        }
        if (payload.kind && payload.kind !== "business")
          return json({ error: "Invalid proof type" }, 400, origin);
        const review = checked<any>(
          await db
            .from("verification_review_jobs")
            .select("id,user_id,document_path,reviewed_at")
            .eq("id", payload.id)
            .maybeSingle(),
        );
        if (!review || review.reviewed_at)
          return json({ error: "Review unavailable" }, 404, origin);
        const p = checked<any>(
          await db
            .from("profiles")
            .select(
              "id,account_type,verification_status,verification_doc_path,suspended_at,deletion_requested_at",
            )
            .eq("id", review.user_id)
            .maybeSingle(),
        );
        if (
          !p ||
          p.account_type !== "business" ||
          p.suspended_at ||
          p.deletion_requested_at ||
          p.verification_status !== "pending" ||
          p.verification_doc_path !== review.document_path ||
          !review.document_path.startsWith(review.user_id + "/")
        )
          return json({ error: "Review unavailable" }, 404, origin);
        const signed = checked<any>(
          await db.storage
            .from("verification_docs")
            .createSignedUrl(review.document_path, 60),
        );
        return json({ url: signed.signedUrl, expiresIn: 60 }, 200, origin);
      }
      if (payload.action === "decide") {
        const kind = payload.kind,
          decision = payload.decision;
        if (
          !UUID.test(payload.id ?? "") ||
          !(
            (kind === "business" &&
              ["approved", "rejected"].includes(decision)) ||
            (kind === "selfie" &&
              ["verified", "rejected"].includes(decision)) ||
            (kind === "report" &&
              ["dismiss", "remove", "suspend"].includes(decision))
          ) ||
          typeof payload.note !== "string" ||
          payload.note.length > 200
        )
          return json({ error: "Invalid moderation decision" }, 400, origin);
        if (
          ["rejected", "remove", "suspend"].includes(decision) &&
          !payload.note.trim()
        )
          return json({ error: "Review reason required" }, 400, origin);
        if (
          kind === "report" &&
          decision === "suspend" &&
          member.data.role !== "owner"
        )
          return json(
            { error: "Only owners can suspend accounts" },
            403,
            origin,
          );
        if (kind === "selfie" && decision === "verified")
          await selfieComparison(payload.id);
        checked(
          await db.rpc("admin_console_decide", {
            p_actor: user.id,
            p_kind: kind,
            p_record_id: payload.id,
            p_decision: decision,
            p_note: payload.note.trim(),
          }),
        );
        return json({ ok: true }, 200, origin);
      }
      return json({ error: "Unknown action" }, 400, origin);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed";
      const safe =
        /^(review unavailable|review expired|report already reviewed|invalid|unsupported|review reason required)/i.test(
          message,
        );
      return json(
        {
          error: safe
            ? message
            : "Request failed. Please refresh and try again.",
        },
        safe ? 409 : 500,
        origin,
      );
    }
  };
}
