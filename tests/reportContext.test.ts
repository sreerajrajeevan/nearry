import { test } from "node:test";
import assert from "node:assert/strict";
import {
  reportContext,
  ownPublicImage,
  MESSAGE_WINDOW,
} from "../supabase/functions/_shared/reportContext";
import { createAdminConsoleHandler } from "../supabase/functions/_shared/adminConsole";

const BASE = "https://project.supabase.co";
const id = (n: number) =>
  `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const reporter = id(1),
  host = id(2),
  admin = id(3),
  post = id(10),
  conv = id(20);

/** Tiny query builder over in-memory tables: eq/in/lt/gt/order/limit. */
function fakeDb(tables: Record<string, any[]>, emails: Record<string, string>) {
  const inserts: any[] = [];
  const from = (table: string) => {
    let rows = [...(tables[table] ?? [])];
    let limit = Infinity;
    const chain: any = {
      select: () => chain,
      eq: (k: string, v: any) => (
        (rows = rows.filter((r) => r[k] === v)),
        chain
      ),
      in: (k: string, v: any[]) => (
        (rows = rows.filter((r) => v.includes(r[k]))),
        chain
      ),
      is: (k: string, v: any) => (
        (rows = rows.filter((r) => (r[k] ?? null) === v)),
        chain
      ),
      lt: (k: string, v: any) => ((rows = rows.filter((r) => r[k] < v)), chain),
      gt: (k: string, v: any) => ((rows = rows.filter((r) => r[k] > v)), chain),
      order: (k: string, o?: { ascending?: boolean }) => {
        const dir = o?.ascending === false ? -1 : 1;
        rows.sort((a, b) => (a[k] < b[k] ? -dir : a[k] > b[k] ? dir : 0));
        return chain;
      },
      limit: (n: number) => ((limit = n), chain),
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      insert: async (row: any) => {
        inserts.push({ table, row });
        return { data: null, error: null };
      },
      then: (yes: any, no: any) =>
        Promise.resolve({ data: rows.slice(0, limit), error: null }).then(
          yes,
          no,
        ),
    };
    return chain;
  };
  return {
    inserts,
    db: {
      from,
      auth: {
        admin: {
          getUserById: async (uid: string) => ({
            data: { user: { id: uid, email: emails[uid] ?? null } },
            error: null,
          }),
        },
        getUser: async (token: string) => ({
          data: {
            user:
              token === "valid"
                ? { id: admin, email_confirmed_at: "2026-01-01" }
                : null,
          },
          error: null,
        }),
        mfa: {
          getAuthenticatorAssuranceLevel: async () => ({
            data: { currentLevel: "aal2" },
            error: null,
          }),
        },
      },
    },
  };
}

const at = (minute: number) =>
  `2026-11-17T10:${String(minute).padStart(2, "0")}:00.000Z`;
function world() {
  const messages = Array.from({ length: 14 }, (_, i) => ({
    id: id(100 + i),
    conversation_id: conv,
    sender_id: i % 2 ? host : reporter,
    body: `message ${i}`,
    created_at: at(i),
  }));
  return {
    profiles: [
      {
        id: reporter,
        account_type: "personal",
        display_name: "Asha",
        created_at: at(0),
      },
      {
        id: host,
        account_type: "personal",
        display_name: "Vik",
        created_at: at(0),
        suspended_at: null,
      },
      {
        id: admin,
        account_type: "personal",
        display_name: "Admin",
        created_at: at(0),
      },
    ],
    admin_console_members: [
      { user_id: admin, role: "moderator", revoked_at: null },
    ],
    posts: [
      {
        id: post,
        author_id: host,
        title: "Football tonight",
        description: "Bring boots",
        venue_name: "Unity Turf",
        starts_at: at(30),
        status: "open",
        vacancies: 4,
        cost_cents: 15000,
        created_at: at(1),
      },
    ],
    post_photos: [
      {
        id: id(11),
        post_id: post,
        photo_url: `${BASE}/storage/v1/object/public/post_photos/a.jpg`,
        sort_order: 0,
      },
      {
        id: id(12),
        post_id: post,
        photo_url: "https://evil.example/tracker.png",
        sort_order: 1,
      },
    ],
    join_requests: [
      { id: id(13), post_id: post, status: "approved" },
      { id: id(14), post_id: post, status: "pending" },
    ],
    conversations: [
      { id: conv, post_id: post, booking_id: null, created_at: at(0) },
    ],
    messages,
    removed_content: [],
    content_reports: [
      {
        id: id(50),
        reporter_id: reporter,
        subject_user_id: host,
        target_kind: "post",
        target_id: post,
        reason: "scam",
        details: "Asked for money upfront",
        snapshot: "Football tonight\nBring boots",
        status: "open",
        created_at: at(40),
      },
      {
        id: id(51),
        reporter_id: reporter,
        subject_user_id: host,
        target_kind: "message",
        target_id: id(107),
        reason: "harassment",
        details: "",
        snapshot: "message 7",
        status: "open",
        created_at: at(41),
      },
      {
        id: id(52),
        reporter_id: id(4),
        subject_user_id: host,
        target_kind: "user",
        target_id: host,
        reason: "spam",
        details: "",
        snapshot: "",
        status: "resolved",
        created_at: at(5),
      },
    ],
  };
}

test("report context names the reporter and the reported person, with their histories", async () => {
  const { db } = fakeDb(world(), {
    [reporter]: "asha@example.com",
    [host]: "vik@example.com",
  });
  const ctx = await reportContext(db, id(50), BASE);
  assert.equal(ctx.reporter.display_name, "Asha");
  assert.equal(ctx.reporter.email, "asha@example.com");
  assert.deepEqual(ctx.reporter.reportsFiled, {
    total: 2,
    open: 2,
    upheld: 0,
    dismissed: 0,
  });
  assert.equal(ctx.subject.display_name, "Vik");
  assert.equal(ctx.subject.email, "vik@example.com");
  // This report is excluded from "other reports against them".
  assert.deepEqual(ctx.subject.otherReportsAgainst, {
    total: 2,
    open: 1,
    upheld: 1,
    dismissed: 0,
  });
  assert.equal(ctx.report.reporter_id, undefined);
  assert.equal(ctx.report.details, "Asked for money upfront");
});

test("post reports show the live plan; only this project's images are returned", async () => {
  const { db } = fakeDb(world(), {});
  const { content } = await reportContext(db, id(50), BASE);
  assert.equal(content.title, "Football tonight");
  assert.equal(content.body, "Bring boots");
  assert.deepEqual(content.images, [
    `${BASE}/storage/v1/object/public/post_photos/a.jpg`,
  ]);
  const fields = Object.fromEntries(content.fields);
  assert.equal(fields.Where, "Unity Turf");
  assert.equal(fields.Joined, 1);
  assert.equal(fields.Cost, "₹150 / person");
  assert.equal(content.missing, false);
  assert.equal(ownPublicImage("https://evil.example/x.png", BASE), null);
  assert.equal(
    ownPublicImage(`${BASE}/storage/v1/object/sign/private/x.png`, BASE),
    null,
  );
});

test("message reports show only a small window around the reported message", async () => {
  const { db } = fakeDb(world(), {});
  const { content } = await reportContext(db, id(51), BASE);
  const bodies = content.messages.map((m: any) => m.body);
  assert.equal(bodies.length, MESSAGE_WINDOW * 2 + 1);
  assert.equal(bodies[0], "message 2");
  assert.equal(bodies.at(-1), "message 12");
  assert.equal(content.messages.find((m: any) => m.reported).body, "message 7");
  assert.equal(content.messages[0].sender, "Asha");
});

test("deleted content and removed content are flagged, not hidden", async () => {
  const w = world();
  w.posts = [];
  const { db } = fakeDb(w, {});
  const gone = await reportContext(db, id(50), BASE);
  assert.equal(gone.content.missing, true);
  const w2 = world();
  w2.removed_content = [
    { target_kind: "post", target_id: post, removed_at: at(45) },
  ];
  const removed = await reportContext(fakeDb(w2, {}).db, id(50), BASE);
  assert.equal(removed.content.removedAt, at(45));
});

test("admin API: report context needs a valid id, and viewing messages is audited", async () => {
  const { db, inserts } = fakeDb(world(), {});
  const handler = createAdminConsoleHandler(
    db,
    "https://admin.nearry.example",
    BASE,
  );
  const call = (body: any) =>
    handler(
      new Request("https://x/functions/v1/admin-console", {
        method: "POST",
        headers: {
          Origin: "https://admin.nearry.example",
          Authorization: "Bearer valid",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }),
    );
  assert.equal((await call({ action: "report", id: "nope" })).status, 400);
  const post = await call({ action: "report", id: id(50) });
  assert.equal(post.status, 200);
  assert.equal(inserts.length, 0);
  const msg = await call({ action: "report", id: id(51) });
  assert.equal(msg.status, 200);
  assert.deepEqual(inserts[0], {
    table: "admin_console_audit",
    row: {
      actor_id: admin,
      action: "report:view-messages",
      target_id: id(51),
      note: "message",
    },
  });
  const missing = await call({ action: "report", id: id(99) });
  assert.equal(missing.status, 409);
});
