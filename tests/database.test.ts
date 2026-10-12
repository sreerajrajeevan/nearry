import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
let db: any;
let external = false;
const host = "00000000-0000-0000-0000-000000000001",
  b = "00000000-0000-0000-0000-000000000002",
  c = "00000000-0000-0000-0000-000000000003",
  outsider = "00000000-0000-0000-0000-000000000004",
  biz = "00000000-0000-0000-0000-000000000005";
async function asUser<T>(
  id: string | null,
  work: (tx: any) => Promise<T>,
  role = "authenticated",
) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      id ?? "",
    ]);
    return work(tx);
  });
}
async function post(capacity = 2) {
  return (
    await db.query(
      `insert into posts(author_id,title,description,starts_at,expires_at,vacancies) values($1,'Football tonight','Friendly football game',now()+interval '4 hours',now()+interval '3 hours',$2) returning id`,
      [host, capacity],
    )
  ).rows[0].id;
}
async function request(id: string, pid: string) {
  return asUser(
    id,
    async (tx) =>
      (await tx.query("select request_join($1) as r", [pid])).rows[0].r.id,
  );
}
before(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (url) {
    if (new URL(url).pathname !== "/nearry_test")
      throw new Error("Tests require a disposable database named nearry_test.");
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url });
    external = true;
    db = {
      exec: (sql: string) => pool.query(sql),
      query: (sql: string, params?: unknown[]) => pool.query(sql, params),
      close: () => pool.end(),
      transaction: async (work: any) => {
        const client = await pool.connect();
        try {
          await client.query("begin");
          const result = await work({
            exec: (s: string) => client.query(s),
            query: (s: string, p?: unknown[]) => client.query(s, p),
          });
          await client.query("commit");
          return result;
        } catch (e) {
          await client.query("rollback");
          throw e;
        } finally {
          client.release();
        }
      },
    };
  } else db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 grant usage on schema public,auth,storage to anon,authenticated,service_role;
 grant all on storage.objects to anon,authenticated,service_role;
 alter default privileges in schema public grant all on tables to anon,authenticated,service_role;`);
  const files = (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    let sql = await readFile(`supabase/migrations/${file}`, "utf8");
    // Only PostGIS is stubbed; all production authorization/functions/triggers run unchanged.
    if (!external) {
      sql = sql
        .replace(/create extension if not exists "postgis";/g, "")
        .replace(/geography\(point, 4326\)/g, "text")
        .replace(/create index venues_location_idx[^;]+;/g, "");
      sql = sql.replace(
        /create or replace function nearby_venues\([\s\S]*?\$\$ language sql stable;/g,
        "",
      );
      if (file === "00014_location.sql")
        sql = sql.replace(
          /create or replace function nearby_venues_with_distance[\s\S]*?grant execute on function nearby_venues_with_distance[^;]+;/,
          "",
        );
      sql = sql.replace(
        /st_setsrid\(st_makepoint\([^)]*\),\s*4326\)::geography/gi,
        "null",
      );
    }
    try {
      await db.exec(sql);
      if (file === "00009_offers_bookings.sql") {
        await db.exec(`insert into auth.users(id,email,raw_user_meta_data)values('00000000-0000-0000-0000-000000000009','legacy@test.example','{"account_type":"business"}');
        update profiles set verification_status='verified',onboarding_completed=true where id='00000000-0000-0000-0000-000000000009';
        insert into offers(id,business_id,title,description,starts_at,ends_at,status)values('10000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000009','Legacy offer','A legacy offer description',now()+interval '2 hours',now()+interval '4 hours','draft');
        insert into bookings(id,offer_id,customer_id,slot)values('20000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000009',now()+interval '2 hours');
        insert into threads(id,booking_id)values('30000000-0000-0000-0000-000000000009','20000000-0000-0000-0000-000000000009');
        insert into messages(thread_id,sender_id,body)values('30000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000009','Preserve this message');
        insert into notifications(user_id,title,body)values('00000000-0000-0000-0000-000000000009','Legacy notification','Preserve this notification');`);
      }
    } catch (e) {
      throw new Error(
        `Migration ${file}: ${e instanceof Error ? e.message : e}`,
      );
    }
  }
  for (const [id, role] of [
    [host, "personal"],
    [b, "personal"],
    [c, "personal"],
    [outsider, "personal"],
    [biz, "business"],
  ]) {
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",
      [
        id,
        `${id}@test.example`,
        JSON.stringify({ account_type: role, display_name: "Test User" }),
      ],
    );
    await db.query(
      "update profiles set onboarding_completed=true,business_name='Test Salon',business_details='{}',verification_status=$2 where id=$1",
      [id, role === "business" ? "verified" : "unverified"],
    );
  }
});
after(async () => {
  await db?.close();
});
test("all migrations preserve legacy data tables", async () => {
  for (const table of [
    "legacy_messages",
    "legacy_threads",
    "legacy_notifications",
  ])
    assert.equal(
      (await db.query("select to_regclass($1) as t", [table])).rows[0].t,
      table,
    );
});
test("legacy messages, notifications and bookings survive the upgrade", async () => {
  assert.equal(
    (await db.query("select body from legacy_messages")).rows[0].body,
    "Preserve this message",
  );
  assert.equal(
    (await db.query("select body from legacy_notifications")).rows[0].body,
    "Preserve this notification",
  );
  const old = (
    await db.query(
      "select slot_id,hold_expires_at from bookings where id='20000000-0000-0000-0000-000000000009'",
    )
  ).rows[0];
  assert.ok(old.slot_id);
  assert.equal(old.hold_expires_at, null);
});
test("raw request insert/approval and anonymous RPC are rejected", async () => {
  const p = await post();
  await assert.rejects(
    asUser(b, (tx) =>
      tx.query(
        "insert into join_requests(post_id,requester_id,status) values($1,$2,'approved')",
        [p, b],
      ),
    ),
    /permission denied/,
  );
  const r = await request(b, p);
  await assert.rejects(
    asUser(b, (tx) =>
      tx.query("update join_requests set status='approved' where id=$1", [r]),
    ),
    /permission denied/,
  );
  await assert.rejects(
    asUser(
      null,
      (tx) => tx.query("select approve_join_request($1)", [r]),
      "anon",
    ),
    /permission denied/,
  );
  await assert.rejects(
    asUser(b, (tx) => tx.query("select approve_join_request($1)", [r])),
    /host/,
  );
});
test("capacity, consistent counts, withdrawal and closure", async () => {
  const p = await post(1),
    r = await request(b, p),
    r2 = await request(c, p);
  await asUser(host, (tx) => tx.query("select approve_join_request($1)", [r]));
  await assert.rejects(
    asUser(host, (tx) => tx.query("select approve_join_request($1)", [r2])),
    /closed|full/,
  );
  for (const id of [host, b, c, outsider]) {
    const result = await asUser(id, (tx) =>
      tx.query("select approved_count,status from post_cards where id=$1", [p]),
    );
    assert.equal(result.rows[0].approved_count, 1);
    assert.equal(result.rows[0].status, "closed");
  }
  const privateRows = await asUser(outsider, (tx) =>
    tx.query("select * from join_requests where post_id=$1", [p]),
  );
  assert.equal(privateRows.rows.length, 0);
  await assert.rejects(
    asUser(c, (tx) => tx.query("select withdraw_join_request($1)", [r])),
    /participant/,
  );
  await asUser(b, (tx) => tx.query("select withdraw_join_request($1)", [r]));
  assert.equal(
    (await db.query("select status from posts where id=$1", [p])).rows[0]
      .status,
    "open",
  );
  await asUser(host, (tx) => tx.query("select approve_join_request($1)", [r2]));
  await asUser(host, (tx) => tx.query("select cancel_post($1)", [p]));
  await asUser(c, (tx) => tx.query("select withdraw_join_request($1)", [r2]));
  assert.equal(
    (await db.query("select status from posts where id=$1", [p])).rows[0]
      .status,
    "cancelled",
  );
});
test("no self-joining, duplicates, expired joins or direct post status edits", async () => {
  const p = await post();
  await assert.rejects(request(host, p), /own post/);
  await request(b, p);
  await assert.rejects(request(b, p), /already/);
  await assert.rejects(
    asUser(host, (tx) =>
      tx.query("update posts set status='open' where id=$1", [p]),
    ),
    /permission denied/,
  );
  await db.query(
    "update posts set expires_at=now()+interval '1 minute' where id=$1",
    [p],
  );
  // Time-based expiry is enforced using server time, not a client field.
  await db.query("alter table posts disable trigger trg_guard_post_edit");
  await db.query(
    "update posts set expires_at=now()-interval '1 minute' where id=$1",
    [p],
  );
  await db.query("alter table posts enable trigger trg_guard_post_edit");
  await assert.rejects(request(c, p), /expired/);
});
test("private profile fields and protected role cannot be read/changed by other users", async () => {
  await assert.rejects(
    asUser(outsider, (tx) =>
      tx.query(
        "select business_details,verification_doc_path from profiles where id=$1",
        [biz],
      ),
    ),
    /permission denied/,
  );
  const own = await asUser(b, (tx) => tx.query("select get_my_profile() as p"));
  assert.equal(own.rows[0].p.id, b);
  await assert.rejects(
    asUser(b, (tx) =>
      tx.query("update profiles set account_type='business' where id=$1", [b]),
    ),
    /permission denied/,
  );
  await assert.rejects(
    asUser(b, (tx) =>
      tx.query(
        "update profiles set verification_status='verified' where id=$1",
        [b],
      ),
    ),
    /permission denied/,
  );
  await assert.rejects(
    asUser(b, (tx) => tx.query("select select_account_type('business')")),
    /already/,
  );
});
test("new Google user chooses Business once without changing returning roles", async () => {
  const id = "00000000-0000-0000-0000-000000000006";
  await db.query(
    "insert into auth.users(id,email,raw_user_meta_data)values($1,'google@test.example','{}')",
    [id],
  );
  assert.equal(
    (await db.query("select role_selected from profiles where id=$1", [id]))
      .rows[0].role_selected,
    false,
  );
  await asUser(id, (tx) => tx.query("select select_account_type('business')"));
  assert.equal(
    (await db.query("select account_type from profiles where id=$1", [id]))
      .rows[0].account_type,
    "business",
  );
  await assert.rejects(
    asUser(id, (tx) => tx.query("select select_account_type('personal')")),
    /already/,
  );
});
test("unverified publishing and self-service venue claims fail", async () => {
  const venue = (await db.query("select id from venues limit 1")).rows[0].id;
  await assert.rejects(
    asUser(b, (tx) => tx.query("select claim_venue($1)", [venue])),
    /review/,
  );
  await assert.rejects(
    asUser(b, (tx) =>
      tx.query(
        `insert into offers(business_id,title,description,starts_at,ends_at,status)values($1,'Sale offer','Example description',now()+interval '2 hours',now()+interval '4 hours','live')`,
        [b],
      ),
    ),
    /business onboarding/,
  );
});
let oid: string, sid: string, bkid: string;
test("stable slots enforce capacity and block direct booking bypasses", async () => {
  oid = (
    await db.query(
      `insert into offers(business_id,title,description,starts_at,ends_at,slot_capacity,status)values($1,'Haircut offer','A test haircut offer',date_trunc('minute',now())+interval '2 hours',date_trunc('minute',now())+interval '4 hours',1,'live')returning id`,
      [biz],
    )
  ).rows[0].id;
  sid = (
    await db.query(
      "select id from offer_slots where offer_id=$1 order by starts_at",
      [oid],
    )
  ).rows[0].id;
  await assert.rejects(
    asUser(b, (tx) =>
      tx.query(
        "insert into bookings(offer_id,customer_id,slot,party_size)values($1,$2,now()+interval '2 hours',999)",
        [oid, b],
      ),
    ),
    /permission denied/,
  );
  const result = await asUser(b, (tx) =>
    tx.query("select book_offer_slot($1,1) as r", [sid]),
  );
  bkid = result.rows[0].r.booking_id;
  await assert.rejects(
    asUser(c, (tx) => tx.query("select book_offer_slot($1,1)", [sid])),
    /seats/,
  );
  await assert.rejects(
    asUser(b, (tx) =>
      tx.query("update bookings set status='confirmed' where id=$1", [bkid]),
    ),
    /permission denied/,
  );
  await assert.rejects(
    asUser(b, (tx) =>
      tx.query("select change_booking_status($1,'confirmed')", [bkid]),
    ),
    /business/,
  );
  await assert.rejects(
    asUser(c, (tx) =>
      tx.query("select change_booking_status($1,'cancelled')", [bkid]),
    ),
    /not your/,
  );
  await assert.rejects(
    asUser(c, (tx) =>
      tx.query(
        "select create_booking($1,now()+interval '2 hours 1 minute',1)",
        [oid],
      ),
    ),
    /business-defined/,
  );
});
test("cancellation releases capacity and cannot be reconfirmed", async () => {
  await asUser(b, (tx) =>
    tx.query("select change_booking_status($1,'cancelled')", [bkid]),
  );
  await asUser(c, (tx) => tx.query("select book_offer_slot($1,1)", [sid]));
  await assert.rejects(
    asUser(biz, (tx) =>
      tx.query("select change_booking_status($1,'confirmed')", [bkid]),
    ),
    /cannot be confirmed/,
  );
});
test("expired pending holds release seats and cannot be confirmed", async () => {
  const id = (
    await db.query(
      "select id from bookings where slot_id=$1 and customer_id=$2",
      [sid, c],
    )
  ).rows[0].id;
  await db.query(
    "update bookings set hold_expires_at=now()-interval '1 minute' where id=$1",
    [id],
  );
  await assert.rejects(
    asUser(biz, (tx) =>
      tx.query("select change_booking_status($1,'confirmed')", [id]),
    ),
    /cannot be confirmed/,
  );
  await asUser(b, (tx) => tx.query("select book_offer_slot($1,1)", [sid]));
});
test("server outbox and notification text are inaccessible to clients", async () => {
  await assert.rejects(
    asUser(b, (tx) => tx.query("select claim_push_jobs()")),
    /permission denied/,
  );
  await assert.rejects(
    asUser(b, (tx) => tx.query("select * from push_jobs")),
    /permission denied/,
  );
  await assert.rejects(
    asUser(b, (tx) => tx.query("update notifications set title='forged'")),
    /permission denied/,
  );
  const count = (await db.query("select count(*) as n from push_jobs")).rows[0]
    .n;
  assert.ok(Number(count) > 0);
});
test("a push token moves to current account only", async () => {
  await asUser(b, (tx) =>
    tx.query(
      "select register_push_token('ExponentPushToken[test123]','android')",
    ),
  );
  await asUser(c, (tx) =>
    tx.query(
      "select register_push_token('ExponentPushToken[test123]','android')",
    ),
  );
  const rows = (
    await db.query(
      "select user_id from push_tokens where token='ExponentPushToken[test123]' ",
    )
  ).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].user_id, c);
});

test(
  "simultaneous last-spot approvals and bookings serialize across connections",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const p = await post(1),
      rb = await request(b, p),
      rc = await request(c, p);
    const approvals = await Promise.allSettled([
      asUser(host, (tx) => tx.query("select approve_join_request($1)", [rb])),
      asUser(host, (tx) => tx.query("select approve_join_request($1)", [rc])),
    ]);
    assert.equal(approvals.filter((r) => r.status === "fulfilled").length, 1);
    const slots = (
      await db.query(
        "select id from offer_slots where offer_id=$1 order by starts_at desc",
        [oid],
      )
    ).rows;
    const bookings = await Promise.allSettled([
      asUser(b, (tx) =>
        tx.query("select book_offer_slot($1,1)", [slots[0].id]),
      ),
      asUser(c, (tx) =>
        tx.query("select book_offer_slot($1,1)", [slots[0].id]),
      ),
    ]);
    assert.equal(bookings.filter((r) => r.status === "fulfilled").length, 1);
  },
);
