const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIFETIME = "9999-12-31T00:00:00Z";
const encoder = new TextEncoder();

function safeEqual(a: string, b: string): boolean {
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++)
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

type Deps = {
  db: any;
  webhookSecret: string;
  revenueCatKey: string;
  fetch: typeof fetch;
};

// Only RevenueCat's REST API decides premium status; webhook bodies just say who to refresh.
export function createPremiumHandler(deps: Deps) {
  const { db, webhookSecret, revenueCatKey } = deps;

  async function refresh(id: string): Promise<string | null> {
    const res = await deps.fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(id)}`,
      { headers: { Authorization: `Bearer ${revenueCatKey}` } },
    );
    if (!res.ok) throw new Error(`RevenueCat ${res.status}`);
    const subscriber = (await res.json())?.subscriber;
    const ent = subscriber?.entitlements?.premium;
    if (!ent) {
      const { error } = await db
        .from("premium_entitlements")
        .delete()
        .eq("user_id", id);
      if (error) throw error;
      return null;
    }
    const sub = subscriber?.subscriptions?.[ent.product_identifier];
    let expires: string = ent.expires_date ?? LIFETIME;
    for (const grace of [
      sub?.grace_period_expires_date,
      ent.grace_period_expires_date,
    ])
      if (typeof grace === "string" && Date.parse(grace) > Date.parse(expires))
        expires = grace;
    const { error } = await db.from("premium_entitlements").upsert(
      {
        user_id: id,
        expires_at: expires,
        product_id: ent.product_identifier ?? null,
        store: sub?.store ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    // 23503: the account was deleted; nothing to grant.
    if (error && error.code !== "23503") throw error;
    return error ? null : expires;
  }

  return async (req: Request) => {
    if (req.method !== "POST")
      return new Response("method not allowed", { status: 405 });
    const header = req.headers.get("Authorization") ?? "";
    if (!header.startsWith("Bearer ") || header.length <= 7)
      return json({ error: "unauthorized" }, 401);
    const body: any = await req.json().catch(() => null);

    try {
      if (safeEqual(header, `Bearer ${webhookSecret}`)) {
        const e = body?.event ?? {};
        const candidates = [
          e.app_user_id,
          e.original_app_user_id,
          ...(Array.isArray(e.aliases) ? e.aliases : []),
          ...(Array.isArray(e.transferred_from) ? e.transferred_from : []),
          ...(Array.isArray(e.transferred_to) ? e.transferred_to : []),
        ];
        const ids = [
          ...new Set(
            candidates
              .filter((v) => typeof v === "string" && uuid.test(v))
              .map((v) => v.toLowerCase()),
          ),
        ];
        for (const id of ids) await refresh(id);
        return json({ ok: true });
      }

      // A webhook-shaped body without the right secret is an auth failure.
      if (body?.event !== undefined)
        return json({ error: "unauthorized" }, 401);
      if (body?.action !== "sync") return json({ error: "bad request" }, 400);
      const { data, error } = await db.auth.getUser(header.slice(7));
      if (error || !data?.user?.id) return json({ error: "unauthorized" }, 401);
      return json({ expires_at: await refresh(data.user.id) });
    } catch (e) {
      // Never log headers or the body: they carry secrets and user ids.
      console.error("revenuecat-webhook", String(e));
      return json({ error: "upstream failure" }, 502);
    }
  };
}
