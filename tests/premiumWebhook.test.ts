import test from "node:test";
import assert from "node:assert/strict";
import { createPremiumHandler } from "../supabase/functions/_shared/premiumHandler";

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const SECRET = "whsec";

function setup({
  subscribers = {} as Record<string, any>,
  upsertError = null as any,
  apiStatus = 200,
  jwtUser = A as string | null,
} = {}) {
  const upserts: any[] = [];
  const deletes: string[] = [];
  const fetched: { url: string; auth: string | null }[] = [];
  const db = {
    auth: {
      async getUser(jwt: string) {
        return jwtUser && jwt === "good"
          ? { data: { user: { id: jwtUser } }, error: null }
          : { data: { user: null }, error: new Error("bad") };
      },
    },
    from(table: string) {
      assert.equal(table, "premium_entitlements");
      return {
        async upsert(row: any, opts: any) {
          assert.deepEqual(opts, { onConflict: "user_id" });
          upserts.push(row);
          return { error: upsertError };
        },
        delete() {
          return {
            async eq(col: string, id: string) {
              assert.equal(col, "user_id");
              deletes.push(id);
              return { error: null };
            },
          };
        },
      };
    },
  };
  const fakeFetch = (async (url: any, init: any) => {
    const u = String(url);
    fetched.push({ url: u, auth: init?.headers?.Authorization ?? null });
    if (apiStatus !== 200) return new Response("nope", { status: apiStatus });
    const id = decodeURIComponent(u.split("/subscribers/")[1]);
    return new Response(
      JSON.stringify({
        subscriber: subscribers[id] ?? { entitlements: {}, subscriptions: {} },
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  const handler = createPremiumHandler({
    db,
    webhookSecret: SECRET,
    revenueCatKey: "rc_key",
    fetch: fakeFetch,
  });
  return { handler, upserts, deletes, fetched };
}
const hook = (body: any, auth = `Bearer ${SECRET}`) =>
  new Request("https://x/f", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const sub = (expires: string | null, grace: string | null = null) => ({
  entitlements: {
    premium: { expires_date: expires, product_identifier: "nearry_monthly" },
  },
  subscriptions: {
    nearry_monthly: { store: "app_store", grace_period_expires_date: grace },
  },
});

test("webhook with the wrong secret is 401 and calls nothing", async () => {
  const t = setup();
  const res = await t.handler(
    hook({ event: { app_user_id: A } }, "Bearer wrong"),
  );
  assert.equal(res.status, 401);
  assert.equal(t.fetched.length, 0);
  assert.equal(t.upserts.length + t.deletes.length, 0);
});

test("purchase event upserts expires_at from RevenueCat, not from the event body", async () => {
  const t = setup({ subscribers: { [A]: sub("2030-01-01T00:00:00Z") } });
  const res = await t.handler(
    hook({
      event: {
        app_user_id: A,
        expiration_at_ms: 1,
        expires_date: "2099-01-01T00:00:00Z",
      },
    }),
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(t.upserts.length, 1);
  assert.equal(t.upserts[0].user_id, A);
  assert.equal(t.upserts[0].expires_at, "2030-01-01T00:00:00Z");
  assert.equal(t.upserts[0].product_id, "nearry_monthly");
  assert.equal(t.upserts[0].store, "app_store");
  assert.equal(t.fetched[0].auth, "Bearer rc_key");
  assert.match(
    t.fetched[0].url,
    /^https:\/\/api\.revenuecat\.com\/v1\/subscribers\//,
  );
});

test("grace period extends expires_at", async () => {
  const t = setup({
    subscribers: { [A]: sub("2030-01-01T00:00:00Z", "2030-01-17T00:00:00Z") },
  });
  await t.handler(hook({ event: { app_user_id: A } }));
  assert.equal(t.upserts[0].expires_at, "2030-01-17T00:00:00Z");
});

test("grace period on the entitlement itself extends expires_at", async () => {
  const t = setup({
    subscribers: {
      [A]: {
        entitlements: {
          premium: {
            expires_date: "2030-01-01T00:00:00Z",
            grace_period_expires_date: "2030-01-10T00:00:00Z",
            product_identifier: "nearry_monthly",
          },
        },
        subscriptions: { nearry_monthly: { store: "play_store" } },
      },
    },
  });
  await t.handler(hook({ event: { app_user_id: A } }));
  assert.equal(t.upserts[0].expires_at, "2030-01-10T00:00:00Z");
});

test("null expires_date means lifetime", async () => {
  const t = setup({ subscribers: { [A]: sub(null) } });
  await t.handler(hook({ event: { app_user_id: A } }));
  assert.equal(t.upserts[0].expires_at, "9999-12-31T00:00:00Z");
});

test("expired or refunded subscriber (no premium entitlement) deletes the row", async () => {
  const t = setup();
  const res = await t.handler(hook({ event: { app_user_id: A } }));
  assert.equal(res.status, 200);
  assert.deepEqual(t.deletes, [A]);
  assert.equal(t.upserts.length, 0);
});

test("transfer refreshes both the old and new user ids", async () => {
  const t = setup({ subscribers: { [B]: sub("2030-01-01T00:00:00Z") } });
  const res = await t.handler(
    hook({ event: { transferred_from: [A], transferred_to: [B] } }),
  );
  assert.equal(res.status, 200);
  assert.deepEqual(t.deletes, [A]);
  assert.deepEqual(
    t.upserts.map((u) => u.user_id),
    [B],
  );
});

test("anonymous ids are ignored and the webhook still returns 200", async () => {
  const t = setup();
  const res = await t.handler(
    hook({
      event: {
        app_user_id: "$RCAnonymousID:abc",
        original_app_user_id: "$RCAnonymousID:abc",
        aliases: ["$RCAnonymousID:abc", A, A],
      },
    }),
  );
  assert.equal(res.status, 200);
  assert.equal(t.fetched.length, 1);
  assert.deepEqual(t.deletes, [A]);
});

test("deleted account (23503) returns 200", async () => {
  const t = setup({
    subscribers: { [A]: sub("2030-01-01T00:00:00Z") },
    upsertError: { code: "23503" },
  });
  const res = await t.handler(hook({ event: { app_user_id: A } }));
  assert.equal(res.status, 200);
});

test("RevenueCat API failure returns 502 and logs without secrets", async (ctx) => {
  const logged: unknown[][] = [];
  ctx.mock.method(console, "error", (...a: unknown[]) => {
    logged.push(a);
  });
  const t = setup({ apiStatus: 500 });
  const res = await t.handler(hook({ event: { app_user_id: A } }));
  assert.equal(logged.length, 1);
  assert.equal(logged[0][0], "revenuecat-webhook");
  assert.ok(!JSON.stringify(logged).includes(SECRET));
  assert.equal(res.status, 502);
});

test("app sync refreshes the signed-in user and returns expires_at", async () => {
  const t = setup({ subscribers: { [A]: sub("2030-01-01T00:00:00Z") } });
  const res = await t.handler(hook({ action: "sync" }, "Bearer good"));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { expires_at: "2030-01-01T00:00:00Z" });
  const none = setup();
  const r2 = await none.handler(hook({ action: "sync" }, "Bearer good"));
  assert.deepEqual(await r2.json(), { expires_at: null });
});

test("app sync with a bad token is 401", async () => {
  const t = setup();
  const res = await t.handler(hook({ action: "sync" }, "Bearer bad"));
  assert.equal(res.status, 401);
  assert.equal(t.fetched.length, 0);
});

test("missing header is 401 and bad sync body is 400", async () => {
  const t = setup();
  const r = await t.handler(
    new Request("https://x/f", { method: "POST", body: "{}" }),
  );
  assert.equal(r.status, 401);
  const r2 = await t.handler(hook({ action: "other" }, "Bearer good"));
  assert.equal(r2.status, 400);
});
