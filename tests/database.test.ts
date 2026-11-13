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
      `insert into posts(author_id,title,description,starts_at,expires_at,vacancies,venue_id) values($1,'Football tonight','Friendly football game',now()+interval '4 hours',now()+interval '3 hours',$2,'10000000-0000-0000-0000-000000000032') returning id`,
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
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,created_at timestamptz default now());
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
      if (file === "00031_post_meeting_locations.sql")
        sql = sql.replace(
          /create function public.nearby_post_cards[\s\S]*?grant execute on function public.nearby_post_cards[^;]+;/,
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
      if (file === "00028_post_audience_readmodel.sql") {
        // Reproduce the upgrade path: a restriction already saved before the
        // read-model correction must become visible without rewriting the post.
        await db.exec(`insert into posts(id,author_id,title,description,starts_at,vacancies,gender_preference)
          values('10000000-0000-0000-0000-000000000028','00000000-0000-0000-0000-000000000009','Existing women’s plan','Preserve the existing saved audience',now()+interval '4 hours',4,'female');`);
      }
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
  await db.exec(
    "insert into venues(id,name,category,area) values('10000000-0000-0000-0000-000000000032','Test meeting venue','Café','Kakkanad')",
  );
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
      "update profiles set age=25,gender='male',terms_version='2026-10-19',onboarding_completed=true,business_name='Test Salon',business_details='{}',verification_status=$2 where id=$1",
      [id, role === "business" ? "verified" : "unverified"],
    );
  }
});
after(async () => {
  await db?.close();
});
// This reset is exercised in a rolled-back transaction, so later fixtures survive.
test("operator testing reset clears the actual schema without removing admin access or global cost limits", async () => {
  const { clearDataSql, CLEAR_TABLES, PROJECT } =
    await import("../scripts/reset-test-data.mjs");
  const owner = "00000000-0000-0000-0000-00000000ff01";
  const existingOwner = (
    await db.query(
      "select id from auth.users where lower(email)='cocsreeraj@gmail.com'",
    )
  ).rows;
  assert.equal(existingOwner.length, 0);
  const rolledBack = new Error("expected reset test rollback");
  try {
    await db.transaction(async (tx: any) => {
      await tx.query(
        "insert into auth.users(id,email,raw_user_meta_data) values($1,'cocsreeraj@gmail.com','{}')",
        [owner],
      );
      await tx.query(
        "insert into admin_console_members(user_id,role) values($1,'owner')",
        [owner],
      );
      await tx.query(
        "update profiles set avatar_url=$2,verification_doc_path='old-proof' where id=$1",
        [
          owner,
          `https://${PROJECT}.supabase.co/storage/v1/object/public/avatars/${owner}/avatar.jpg`,
        ],
      );
      await tx.exec("delete from storage.objects");
      await tx.exec(
        "insert into place_search_usage(scope,subject,window_start,requests) values('global_day','all',date_trunc('day',now()),7),('user_day','old-account',date_trunc('day',now()),3) on conflict(scope,subject,window_start) do update set requests=excluded.requests",
      );
      const tables = (
        await tx.query(
          "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name",
        )
      ).rows.map((r: any) => r.table_name);
      const userIds = (
        await tx.query("select id::text from auth.users order by id::text")
      ).rows.map((r: any) => r.id);
      const adminIds = (
        await tx.query(
          "select user_id::text from admin_console_members order by user_id::text",
        )
      ).rows.map((r: any) => r.user_id);
      const sql = clearDataSql({
        project: PROJECT,
        ownerPresent: true,
        tables,
        userIds,
        adminIds,
        files: [],
        counts: {},
      });
      // Keep the helper's guards/locks/statements but use this test's rollback boundary.
      await tx.exec(sql.replace(/^begin;/, "").replace(/commit;$/, ""));
      for (const table of CLEAR_TABLES.filter((t: string) =>
        tables.includes(t),
      ))
        assert.equal(
          (await tx.query(`select count(*)::int n from public.${table}`))
            .rows[0].n,
          0,
          table,
        );
      assert.equal(
        (await tx.query("select count(*)::int n from admin_console_members"))
          .rows[0].n,
        adminIds.length,
      );
      assert.equal(
        (
          await tx.query(
            "select avatar_url,verification_doc_path from profiles where id=$1",
            [owner],
          )
        ).rows[0].avatar_url,
        null,
      );
      assert.equal(
        (
          await tx.query(
            "select requests from place_search_usage where scope='global_day' and subject='all' and window_start=date_trunc('day',now())",
          )
        ).rows[0].requests,
        7,
      );
      assert.equal(
        (
          await tx.query(
            "select count(*)::int n from place_search_usage where scope='user_day'",
          )
        ).rows[0].n,
        0,
      );
      // Simulate only the final Auth cascade in this disposable database.
      await tx.query("delete from auth.users where not(id=any($1::uuid[]))", [
        adminIds,
      ]);
      assert.equal(
        (await tx.query("select count(*)::int n from auth.users")).rows[0].n,
        adminIds.length,
      );
      assert.equal(
        (await tx.query("select count(*)::int n from profiles")).rows[0].n,
        adminIds.length,
      );
      throw rolledBack;
    });
    assert.fail("Reset test must roll back");
  } catch (error) {
    if (error !== rolledBack) throw error;
  }
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
test("post photo ownership permits host attachments and rejects another user's writes", async () => {
  const pid = await post();
  const photo = (
    await asUser(host, (tx) =>
      tx.query(
        "insert into post_photos(post_id,photo_url,sort_order) values($1,'https://photos.test/plan.png',0) returning id",
        [pid],
      ),
    )
  ).rows[0];
  const gallery = await asUser(b, (tx) =>
    tx.query("select photo_url from post_photos where post_id=$1", [pid]),
  );
  assert.equal(gallery.rows[0].photo_url, "https://photos.test/plan.png");
  await assert.rejects(
    asUser(b, (tx) =>
      tx.query(
        "insert into post_photos(post_id,photo_url) values($1,'https://photos.test/forged.png')",
        [pid],
      ),
    ),
    /row-level security/,
  );
  await asUser(b, (tx) =>
    tx.query("delete from post_photos where id=$1", [photo.id]),
  );
  assert.equal(
    (
      await db.query("select count(*)::int as n from post_photos where id=$1", [
        photo.id,
      ])
    ).rows[0].n,
    1,
  );
  await asUser(host, (tx) =>
    tx.query("delete from post_photos where id=$1", [photo.id]),
  );
  assert.equal(
    (
      await db.query("select count(*)::int as n from post_photos where id=$1", [
        photo.id,
      ])
    ).rows[0].n,
    0,
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

async function auditBusiness(verified = true) {
  const id = (await db.query("select gen_random_uuid() as id")).rows[0].id;
  await db.query(
    "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",
    [
      id,
      `${id}@test.example`,
      JSON.stringify({ account_type: "business", display_name: "Audit Salon" }),
    ],
  );
  await db.query(
    'update profiles set onboarding_completed=true,business_name=\'Audit Salon\',business_details=\'{"category":"Salon","area":"Kakkanad"}\',verification_status=$2 where id=$1',
    [id, verified ? "verified" : "unverified"],
  );
  return id;
}
async function auditOffer(owner: string) {
  const id = (
    await db.query(
      "insert into offers(business_id,title,description,starts_at,ends_at,slot_capacity,slot_minutes,resource_key,status) values($1,'Audit haircut','A friendly haircut service',date_trunc('minute',now())+interval '2 hours',date_trunc('minute',now())+interval '4 hours',1,30,gen_random_uuid()::text,'live') returning id",
      [owner],
    )
  ).rows[0].id;
  const slot = (
    await db.query(
      "select id from offer_slots where offer_id=$1 order by starts_at limit 1",
      [id],
    )
  ).rows[0].id;
  return { id, slot };
}

test("audit: proof submission works without pg_net and queues a private review job", async () => {
  const owner = await auditBusiness(false);
  const path = `${owner}/proof.jpg`;
  await asUser(owner, (tx) =>
    tx.query(
      "insert into storage.objects(bucket_id,name) values('verification_docs',$1)",
      [path],
    ),
  );
  await asUser(owner, (tx) =>
    tx.query("select submit_verification($1)", [path]),
  );
  assert.equal(
    (
      await db.query("select verification_status from profiles where id=$1", [
        owner,
      ])
    ).rows[0].verification_status,
    "pending",
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from verification_review_jobs where user_id=$1 and document_path=$2",
        [owner, path],
      )
    ).rows[0].n,
    1,
  );
});

test("audit: an offer cannot have a window shorter than one bookable slot", async () => {
  const owner = await auditBusiness();
  await assert.rejects(
    asUser(owner, (tx) =>
      tx.query(
        "insert into offers(business_id,title,description,starts_at,ends_at,slot_minutes,status) values($1,'Short offer','A test offer description',now()+interval '2 hours',now()+interval '2 hours 5 minutes',60,'live')",
        [owner],
      ),
    ),
    /slot|window|invalid/,
  );
});

test("audit: customer retains offer context after an offer is cancelled; outsider cannot read drafts", async () => {
  const owner = await auditBusiness();
  const offer = await auditOffer(owner);
  await asUser(b, (tx) =>
    tx.query("select book_offer_slot($1,1)", [offer.slot]),
  );
  await db.query("update offers set status='cancelled' where id=$1", [
    offer.id,
  ]);
  const visible = await asUser(b, (tx) =>
    tx.query("select title,business_id from offers where id=$1", [offer.id]),
  );
  assert.equal(visible.rows.length, 1);
  assert.equal(visible.rows[0].business_id, owner);
  assert.equal(
    (
      await asUser(outsider, (tx) =>
        tx.query("select id from offers where id=$1", [offer.id]),
      )
    ).rows.length,
    0,
  );
});

test("audit: chat members cannot forge message timestamps or direct read watermarks", async () => {
  const p = await post();
  const r = await request(b, p);
  await asUser(host, (tx) => tx.query("select approve_join_request($1)", [r]));
  const conversation = (
    await asUser(b, (tx) =>
      tx.query("select get_or_create_conversation($1,$2,null) id", [host, p]),
    )
  ).rows[0].id;
  await assert.rejects(
    asUser(b, (tx) =>
      tx.query(
        "insert into messages(conversation_id,sender_id,body,created_at) values($1,$2,'Forged future message',now()+interval '1 year')",
        [conversation, b],
      ),
    ),
    /permission denied/,
  );
  await assert.rejects(
    asUser(b, (tx) =>
      tx.query(
        "insert into conversation_reads(conversation_id,user_id,last_read_at) values($1,$2,now()+interval '1 year')",
        [conversation, b],
      ),
    ),
    /permission denied/,
  );
});

test("audit: resubmitting a declined request notifies the host again", async () => {
  const p = await post();
  const r = await request(b, p);
  await asUser(host, (tx) => tx.query("select decline_join_request($1)", [r]));
  await request(b, p);
  const count = (
    await db.query(
      "select count(*)::int n from notifications where user_id=$1 and ref_id=$2 and kind='join_request'",
      [host, p],
    )
  ).rows[0].n;
  assert.equal(count, 2);
});

test("audit: owner offer RPC publishes and cancels reservations atomically; foreign and raw writes fail", async () => {
  const owner = await auditBusiness();
  const offer = await auditOffer(owner);
  const booking = (
    await asUser(b, (tx) =>
      tx.query("select book_offer_slot($1,1) result", [offer.slot]),
    )
  ).rows[0].result.booking_id;
  await assert.rejects(
    asUser(owner, (tx) =>
      tx.query("update offers set title='Raw edit' where id=$1", [offer.id]),
    ),
    /permission denied/,
  );
  await assert.rejects(
    asUser(outsider, (tx) =>
      tx.query("select update_offer($1,$2)", [
        offer.id,
        JSON.stringify({ status: "cancelled" }),
      ]),
    ),
    /not yours/,
  );
  await assert.rejects(
    asUser(owner, (tx) =>
      tx.query("select update_offer($1,$2)", [
        offer.id,
        JSON.stringify({ business_id: outsider }),
      ]),
    ),
    /protected/,
  );
  await asUser(owner, (tx) =>
    tx.query("select update_offer($1,$2)", [
      offer.id,
      JSON.stringify({ title: "Updated haircut" }),
    ]),
  );
  await asUser(owner, (tx) =>
    tx.query("select change_booking_status($1,'confirmed')", [booking]),
  );
  await asUser(owner, (tx) =>
    tx.query("select update_offer($1,$2)", [
      offer.id,
      JSON.stringify({ status: "cancelled" }),
    ]),
  );
  assert.equal(
    (await db.query("select status from bookings where id=$1", [booking]))
      .rows[0].status,
    "cancelled",
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from notifications where user_id=$1 and kind='booking_cancelled' and ref_id=$2",
        [b, offer.id],
      )
    ).rows[0].n,
    1,
  );
  assert.deepEqual(
    (
      await asUser(b, (tx) =>
        tx.query("select available_offer_slots($1) slots", [offer.id]),
      )
    ).rows[0].slots,
    [],
  );
  await assert.rejects(
    asUser(owner, (tx) =>
      tx.query("select update_offer($1,$2)", [
        offer.id,
        JSON.stringify({ status: "live" }),
      ]),
    ),
    /reopen/,
  );
});

test("audit: read cursors acknowledge only displayed messages and reject another conversation", async () => {
  const p = await post();
  const r = await request(b, p);
  await asUser(host, (tx) => tx.query("select approve_join_request($1)", [r]));
  const conversation = (
    await asUser(b, (tx) =>
      tx.query("select get_or_create_conversation($1,$2,null) id", [host, p]),
    )
  ).rows[0].id;
  const first = (
    await asUser(host, (tx) =>
      tx.query(
        "insert into messages(conversation_id,sender_id,body) values($1,$2,'First message') returning id",
        [conversation, host],
      ),
    )
  ).rows[0].id;
  const second = (
    await asUser(host, (tx) =>
      tx.query(
        "insert into messages(conversation_id,sender_id,body) values($1,$2,'Arrived after snapshot') returning id",
        [conversation, host],
      ),
    )
  ).rows[0].id;
  await asUser(b, (tx) =>
    tx.query("select mark_conversation_read($1,$2)", [conversation, first]),
  );
  const list = (
    await asUser(b, (tx) => tx.query("select list_my_conversations() result"))
  ).rows[0].result;
  assert.equal(
    list.find((row: any) => row.id === conversation)?.unread_count,
    1,
  );
  await assert.rejects(
    asUser(outsider, (tx) =>
      tx.query("select mark_conversation_read($1,$2)", [conversation, second]),
    ),
    /not a conversation member/,
  );
  await assert.rejects(
    asUser(b, (tx) =>
      tx.query("select mark_conversation_read($1,$2)", [
        conversation,
        "00000000-0000-0000-0000-000000000099",
      ]),
    ),
    /does not belong/,
  );
  await assert.rejects(
    asUser(b, (tx) =>
      tx.query(
        "insert into messages(conversation_id,sender_id,body) values($1,$2,'   ')",
        [conversation, b],
      ),
    ),
    /messages_nonblank/,
  );
  await asUser(b, (tx) =>
    tx.query("select mark_conversation_read($1,$2)", [conversation, second]),
  );
  await asUser(b, (tx) =>
    tx.query("select mark_conversation_read($1,$2)", [conversation, first]),
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from messages m join conversation_reads r on r.conversation_id=m.conversation_id and r.user_id=$2 where m.conversation_id=$1 and m.created_at>r.last_read_at",
        [conversation, b],
      )
    ).rows[0].n,
    0,
  );
});

test("audit: review jobs are private and reviews are atomic, single-use, and bound to the proof", async () => {
  const owner = await auditBusiness(false);
  async function submit(filename: string) {
    const path = `${owner}/${filename}`;
    await asUser(owner, (tx) =>
      tx.query(
        "insert into storage.objects(bucket_id,name) values('verification_docs',$1)",
        [path],
      ),
    );
    await asUser(owner, (tx) =>
      tx.query("select submit_verification($1)", [path]),
    );
    return (
      await db.query(
        "select id from verification_review_jobs where user_id=$1 and document_path=$2",
        [owner, path],
      )
    ).rows[0].id;
  }
  const old = await submit("first.png");
  await assert.rejects(
    asUser(owner, (tx) => tx.query("select * from verification_review_jobs")),
    /permission denied/,
  );
  await assert.rejects(
    asUser(owner, (tx) => tx.query("select claim_verification_jobs()")),
    /permission denied/,
  );
  await assert.rejects(
    asUser(owner, (tx) =>
      tx.query("select review_verification($1,'approved',null)", [old]),
    ),
    /permission denied/,
  );
  await db.query(
    "select review_verification($1,'rejected','Need a clearer photo')",
    [old],
  );
  assert.equal(
    (
      await db.query("select verification_note from profiles where id=$1", [
        owner,
      ])
    ).rows[0].verification_note,
    "Need a clearer photo",
  );
  await assert.rejects(
    db.query("select review_verification($1,'approved',null)", [old]),
    /stale|completed/,
  );
  const current = await submit("new.png");
  assert.equal(
    (
      await db.query("select verification_note from profiles where id=$1", [
        owner,
      ])
    ).rows[0].verification_note,
    null,
  );
  await assert.rejects(
    db.query("select review_verification($1,'approved',null)", [old]),
    /stale|completed/,
  );
  await assert.rejects(
    db.query("select review_verification($1,'bogus',null)", [current]),
    /invalid decision/,
  );
  await db.query("select review_verification($1,'approved',null)", [current]);
  assert.equal(
    (
      await db.query("select verification_status from profiles where id=$1", [
        owner,
      ])
    ).rows[0].verification_status,
    "verified",
  );
  await assert.rejects(
    db.query("select review_verification($1,'rejected','Changed mind')", [
      current,
    ]),
    /stale|completed/,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from notifications where user_id=$1 and kind='verification_approved'",
        [owner],
      )
    ).rows[0].n,
    1,
  );
});

test(
  "audit: concurrent offer cancellation and reservation cannot leave active seats",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const owner = await auditBusiness(),
      offer = await auditOffer(owner);
    await Promise.allSettled([
      asUser(b, (tx) => tx.query("select book_offer_slot($1,1)", [offer.slot])),
      asUser(owner, (tx) =>
        tx.query("select update_offer($1,$2)", [
          offer.id,
          JSON.stringify({ status: "cancelled" }),
        ]),
      ),
    ]);
    assert.equal(
      (await db.query("select status from offers where id=$1", [offer.id]))
        .rows[0].status,
      "cancelled",
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from bookings where offer_id=$1 and status in ('pending','confirmed')",
          [offer.id],
        )
      ).rows[0].n,
      0,
    );
  },
);

test(
  "audit: concurrent reviewers save one decision and workers lease distinct review jobs",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const owner = await auditBusiness(false),
      path = `${owner}/proof.png`;
    await asUser(owner, (tx) =>
      tx.query(
        "insert into storage.objects(bucket_id,name) values('verification_docs',$1)",
        [path],
      ),
    );
    await asUser(owner, (tx) =>
      tx.query("select submit_verification($1)", [path]),
    );
    const job = (
      await db.query(
        "select id from verification_review_jobs where user_id=$1",
        [owner],
      )
    ).rows[0].id;
    const leases = await Promise.all([
      asUser(
        null,
        (tx) => tx.query("select * from claim_verification_jobs()"),
        "service_role",
      ),
      asUser(
        null,
        (tx) => tx.query("select * from claim_verification_jobs()"),
        "service_role",
      ),
    ]);
    const ids = leases.flatMap((result) =>
      result.rows.map((row: any) => row.id),
    );
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.includes(job));
    const decisions = await Promise.allSettled([
      asUser(
        null,
        (tx) =>
          tx.query("select review_verification($1,'approved',null)", [job]),
        "service_role",
      ),
      asUser(
        null,
        (tx) =>
          tx.query(
            "select review_verification($1,'rejected','Unclear proof')",
            [job],
          ),
        "service_role",
      ),
    ]);
    assert.equal(
      decisions.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from notifications where user_id=$1 and kind in ('verification_approved','verification_rejected')",
          [owner],
        )
      ).rows[0].n,
      1,
    );
  },
);

test("audit: offers inherit reviewed venue ownership, and unverified drafts cannot publish through RPC", async () => {
  const owner = await auditBusiness(false);
  const venue = (
    await db.query(
      "insert into venues(business_id,name,category,area) values($1,'Audit Salon','Salon','Kakkanad') returning id",
      [owner],
    )
  ).rows[0].id;
  const offer = (
    await asUser(owner, (tx) =>
      tx.query(
        "insert into offers(business_id,title,description,starts_at,ends_at,status) values($1,'Draft haircut','Friendly salon haircut',now()+interval '2 hours',now()+interval '4 hours','draft') returning id,venue_id",
        [owner],
      ),
    )
  ).rows[0];
  assert.equal(offer.venue_id, venue);
  await assert.rejects(
    asUser(owner, (tx) =>
      tx.query("select update_offer($1,$2)", [
        offer.id,
        JSON.stringify({ status: "live" }),
      ]),
    ),
    /verified/,
  );
  await db.query(
    "update profiles set verification_status='verified' where id=$1",
    [owner],
  );
  await asUser(owner, (tx) =>
    tx.query("select update_offer($1,$2)", [
      offer.id,
      JSON.stringify({ status: "live" }),
    ]),
  );
  assert.equal(
    (
      await asUser(outsider, (tx) =>
        tx.query("select id from offers where id=$1", [offer.id]),
      )
    ).rows.length,
    1,
  );
  await db.query(
    "update profiles set verification_status='rejected' where id=$1",
    [owner],
  );
  assert.equal(
    (
      await asUser(outsider, (tx) =>
        tx.query("select id from offers where id=$1", [offer.id]),
      )
    ).rows.length,
    0,
  );
  assert.deepEqual(
    (
      await asUser(b, (tx) =>
        tx.query("select available_offer_slots($1) slots", [offer.id]),
      )
    ).rows[0].slots,
    [],
  );
  const other = await auditBusiness();
  await assert.rejects(
    asUser(other, (tx) =>
      tx.query(
        "insert into offers(business_id,venue_id,title,description,starts_at,ends_at,status) values($1,$2,'Foreign venue','Friendly salon haircut',now()+interval '2 hours',now()+interval '4 hours','draft')",
        [other, venue],
      ),
    ),
    /associated with your business/,
  );
});

test("audit: search metacharacters match literal text rather than broad patterns", async () => {
  const { searchLiteral } = await import("../src/utils/searchFilter");
  for (const term of [
    "50%",
    "a_b",
    "*",
    "(coffee)",
    "a.b",
    "back\\slash",
    "a|b",
    "[x]",
  ]) {
    const pattern = JSON.parse(searchLiteral(term));
    assert.equal(
      (
        await db.query("select $1::text ~* $2::text as matches", [
          `before ${term} after`,
          pattern,
        ])
      ).rows[0].matches,
      true,
    );
    assert.equal(
      (
        await db.query("select $1::text ~* $2::text as matches", [
          "unrelated text",
          pattern,
        ])
      ).rows[0].matches,
      false,
    );
  }
});

test("place search quotas are private, service-only, and enforce a shared daily ceiling", async () => {
  await assert.rejects(
    asUser(b, (tx) => tx.query("select reserve_place_search($1)", [b])),
    /permission denied/,
  );
  await assert.rejects(
    asUser(b, (tx) => tx.query("select * from place_search_usage")),
    /permission denied/,
  );
  await db.query("delete from place_search_usage");
  assert.equal(
    (
      await asUser(
        null,
        (tx) => tx.query("select reserve_place_search($1) allowed", [b]),
        "service_role",
      )
    ).rows[0].allowed,
    true,
  );
  await db.query(
    "update place_search_usage set requests=2800 where scope='global_day'",
  );
  assert.equal(
    (
      await asUser(
        null,
        (tx) => tx.query("select reserve_place_search($1) allowed", [c]),
        "service_role",
      )
    ).rows[0].allowed,
    false,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from place_search_usage where scope='user_day' and subject=$1",
        [c],
      )
    ).rows[0].n,
    0,
  );
});

test(
  "place search concurrent reservations cannot exceed the global daily ceiling",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    await db.query("delete from place_search_usage");
    await db.query(
      "insert into place_search_usage(scope,subject,window_start,requests) values('global_day','all',date_trunc('day',now() at time zone 'UTC') at time zone 'UTC',2799)",
    );
    const attempts = await Promise.all(
      [b, c].map((user) =>
        asUser(
          null,
          (tx) => tx.query("select reserve_place_search($1) allowed", [user]),
          "service_role",
        ),
      ),
    );
    assert.equal(attempts.filter((result) => result.rows[0].allowed).length, 1);
    assert.equal(
      (
        await db.query(
          "select requests from place_search_usage where scope='global_day'",
        )
      ).rows[0].requests,
      2800,
    );
  },
);

test(
  "selected place coordinates return only Nearry venues within the chosen radius",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const near = (
      await db.query(
        "insert into venues(name,category,area,location) values('Place search nearby fixture','Café','Kakkanad',st_setsrid(st_makepoint(76.363,10.007),4326)::geography) returning id",
      )
    ).rows[0].id;
    const far = (
      await db.query(
        "insert into venues(name,category,area,location) values('Place search distant fixture','Café','Elsewhere',st_setsrid(st_makepoint(77.363,11.007),4326)::geography) returning id",
      )
    ).rows[0].id;
    const results = (
      await asUser(b, (tx) =>
        tx.query(
          "select nearby_venues_with_distance(10.007,76.363,5000) places",
        ),
      )
    ).rows[0].places;
    assert.ok(results.some((venue: any) => venue.id === near));
    assert.ok(!results.some((venue: any) => venue.id === far));
    assert.ok(results.every((venue: any) => venue.distance_m <= 5000));
  },
);

async function corePersonal() {
  const id = (await db.query("select gen_random_uuid() id")).rows[0].id;
  await db.query(
    'insert into auth.users(id,email,raw_user_meta_data) values($1,$2,\'{"account_type":"personal","display_name":"Neighbour"}\')',
    [id, `${id}@test.example`],
  );
  await db.query(
    "update profiles set age=25,gender='male',terms_version='2026-10-19',onboarding_completed=true where id=$1",
    [id],
  );
  return id;
}

test("core journey: create, request, approve, chat, read and cancel preserve permissions and notify participants", async () => {
  const owner = await corePersonal(),
    participant = await corePersonal(),
    waiting = await corePersonal();
  const p = (
    await asUser(owner, (tx) =>
      tx.query(
        "insert into posts(author_id,title,description,starts_at,vacancies,venue_id) values($1,'Chaya and a walk','A friendly evening by the waterfront',now()+interval '4 hours',2,'10000000-0000-0000-0000-000000000032') returning id",
        [owner],
      ),
    )
  ).rows[0].id;
  const r = await request(participant, p);
  await request(waiting, p);
  await assert.rejects(
    asUser(waiting, (tx) =>
      tx.query("select get_or_create_conversation($1,$2,null)", [owner, p]),
    ),
    /not allowed/,
  );
  await asUser(owner, (tx) => tx.query("select approve_join_request($1)", [r]));
  const conv = (
    await asUser(participant, (tx) =>
      tx.query("select get_or_create_conversation($1,$2,null) id", [owner, p]),
    )
  ).rows[0].id;
  const msg = (
    await asUser(owner, (tx) =>
      tx.query(
        "insert into messages(conversation_id,sender_id,body) values($1,$2,'See you there!') returning id",
        [conv, owner],
      ),
    )
  ).rows[0].id;
  assert.equal(
    (
      await asUser(waiting, (tx) =>
        tx.query("select * from messages where conversation_id=$1", [conv]),
      )
    ).rows.length,
    0,
  );
  await assert.rejects(
    asUser(waiting, (tx) =>
      tx.query(
        "insert into messages(conversation_id,sender_id,body) values($1,$2,'Outsider')",
        [conv, waiting],
      ),
    ),
    /row-level security/,
  );
  const before = (
    await asUser(participant, (tx) => tx.query("select unread_counts() counts"))
  ).rows[0].counts;
  assert.equal(Number(before.messages), 1);
  assert.equal(
    Number(before.notifications) - Number(before.other_notifications),
    1,
  );
  await asUser(participant, (tx) =>
    tx.query("select mark_conversation_read($1,$2)", [conv, msg]),
  );
  const after = (
    await asUser(participant, (tx) => tx.query("select unread_counts() counts"))
  ).rows[0].counts;
  assert.equal(Number(after.messages), 0);
  assert.equal(
    Number(after.notifications) - Number(after.other_notifications),
    0,
  );
  await asUser(owner, (tx) => tx.query("select cancel_post($1)", [p]));
  for (const user of [participant, waiting]) {
    assert.equal(
      (
        await asUser(user, (tx) =>
          tx.query(
            "select id from notifications where kind='post_cancelled' and ref_id=$1",
            [p],
          ),
        )
      ).rows.length,
      1,
    );
  }
  await assert.rejects(
    asUser(owner, (tx) => tx.query("select cancel_post($1)", [p])),
    /already cancelled|not found/,
  );
  await assert.rejects(request(waiting, p), /closed|expired/);
});

test("core journey: reading one message never acknowledges a newer message from the same transaction", async () => {
  const owner = await corePersonal(),
    participant = await corePersonal();
  const own = (
    await db.query(
      "insert into posts(author_id,title,description,starts_at,vacancies,venue_id) values($1,'Read cursor test','A friendly read cursor regression',now()+interval '4 hours',2,'10000000-0000-0000-0000-000000000032') returning id",
      [owner],
    )
  ).rows[0].id;
  const r = await request(participant, own);
  await asUser(owner, (tx) => tx.query("select approve_join_request($1)", [r]));
  const conv = (
    await asUser(participant, (tx) =>
      tx.query("select get_or_create_conversation($1,$2,null) id", [
        owner,
        own,
      ]),
    )
  ).rows[0].id;
  const ids = (
    await asUser(owner, (tx) =>
      tx.query(
        "insert into messages(conversation_id,sender_id,body) values($1,$2,'First'),($1,$2,'Later') returning id",
        [conv, owner],
      ),
    )
  ).rows;
  // Notifications share transaction time, while messages have separate server chronology.
  await db.query(
    "update messages set created_at=now()+interval '1 second' where id=$1",
    [ids[0].id],
  );
  await db.query(
    "update messages set created_at=now()+interval '2 seconds' where id=$1",
    [ids[1].id],
  );
  await asUser(participant, (tx) =>
    tx.query("select mark_conversation_read($1,$2)", [conv, ids[0].id]),
  );
  const rows = (
    await asUser(participant, (tx) =>
      tx.query(
        "select message_id,read_at from notifications where ref_id=$1 and kind='message' order by message_id",
        [conv],
      ),
    )
  ).rows;
  assert.ok(rows.find((n: any) => n.message_id === ids[0].id).read_at);
  assert.equal(rows.find((n: any) => n.message_id === ids[1].id).read_at, null);
  assert.equal(
    Number(
      (
        await asUser(participant, (tx) =>
          tx.query("select unread_counts() counts"),
        )
      ).rows[0].counts.messages,
    ),
    1,
  );
  await assert.rejects(
    asUser(null, (tx) => tx.query("select unread_counts()"), "anon"),
    /permission denied/,
  );
});

test("core journey: a booking retry returns its active reservation, and business cancellation releases confirmed seats", async () => {
  const business = await auditBusiness(),
    customer = await corePersonal(),
    other = await corePersonal();
  const offer = await auditOffer(business);
  const first = (
    await asUser(customer, (tx) =>
      tx.query("select book_offer_slot($1,1) result", [offer.slot]),
    )
  ).rows[0].result;
  const retry = (
    await asUser(customer, (tx) =>
      tx.query("select book_offer_slot($1,1) result", [offer.slot]),
    )
  ).rows[0].result;
  assert.equal(retry.booking_id, first.booking_id);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from bookings where slot_id=$1 and customer_id=$2",
        [offer.slot, customer],
      )
    ).rows[0].n,
    1,
  );
  await assert.rejects(
    asUser(customer, (tx) =>
      tx.query("select book_offer_slot($1,2)", [offer.slot]),
    ),
    /already requested/,
  );
  await assert.rejects(
    asUser(other, (tx) =>
      tx.query("select change_booking_status($1,'cancelled')", [
        first.booking_id,
      ]),
    ),
    /not your booking/,
  );
  await asUser(business, (tx) =>
    tx.query("select change_booking_status($1,'confirmed')", [
      first.booking_id,
    ]),
  );
  await asUser(business, (tx) =>
    tx.query("select change_booking_status($1,'cancelled')", [
      first.booking_id,
    ]),
  );
  assert.equal(
    (
      await asUser(customer, (tx) =>
        tx.query("select status from bookings where id=$1", [first.booking_id]),
      )
    ).rows[0].status,
    "cancelled",
  );
  await assert.rejects(
    asUser(business, (tx) =>
      tx.query("select change_booking_status($1,'confirmed')", [
        first.booking_id,
      ]),
    ),
    /cannot be confirmed/,
  );
  const next = (
    await asUser(customer, (tx) =>
      tx.query("select book_offer_slot($1,1) result", [offer.slot]),
    )
  ).rows[0].result;
  assert.notEqual(next.booking_id, first.booking_id);
});

test("core journey: deletion works only for owned empty posts and draft offers without history", async () => {
  const owner = await corePersonal(),
    other = await corePersonal();
  const make = async () =>
    (
      await asUser(owner, (tx) =>
        tx.query(
          "insert into posts(author_id,title,description,starts_at,vacancies,venue_id) values($1,'Empty plan','A friendly plan without any requests',now()+interval '4 hours',2,'10000000-0000-0000-0000-000000000032') returning id",
          [owner],
        ),
      )
    ).rows[0].id;
  const empty = await make();
  await assert.rejects(
    asUser(other, (tx) => tx.query("select delete_post($1)", [empty])),
    /not yours|not found/,
  );
  await assert.rejects(
    asUser(owner, (tx) => tx.query("delete from posts where id=$1", [empty])),
    /permission denied/,
  );
  await asUser(owner, (tx) => tx.query("select delete_post($1)", [empty]));
  assert.equal(
    (await db.query("select id from posts where id=$1", [empty])).rows.length,
    0,
  );
  const withHistory = await make();
  await request(other, withHistory);
  await assert.rejects(
    asUser(owner, (tx) => tx.query("select delete_post($1)", [withHistory])),
    /has requests/,
  );
  const business = await auditBusiness();
  const draft = (
    await asUser(business, (tx) =>
      tx.query(
        "insert into offers(business_id,title,description,starts_at,ends_at,status) values($1,'Draft deletion','A friendly draft without bookings',now()+interval '4 hours',now()+interval '6 hours','draft') returning id",
        [business],
      ),
    )
  ).rows[0].id;
  await assert.rejects(
    asUser(other, (tx) => tx.query("select delete_offer($1)", [draft])),
    /not yours|not found/,
  );
  await asUser(business, (tx) => tx.query("select delete_offer($1)", [draft]));
  assert.equal(
    (await db.query("select id from offers where id=$1", [draft])).rows.length,
    0,
  );
});

test("safety: reports are private, deduplicated and only service operators can moderate", async () => {
  const pid = await post();
  const report = await asUser(
    b,
    async (tx) =>
      (
        await tx.query(
          "select submit_content_report('post',$1,'spam','Unwanted advertising') as id",
          [pid],
        )
      ).rows[0].id,
  );
  const again = await asUser(
    b,
    async (tx) =>
      (
        await tx.query(
          "select submit_content_report('post',$1,'scam','Repeated report') as id",
          [pid],
        )
      ).rows[0].id,
  );
  assert.equal(report, again);
  assert.equal(
    (
      await asUser(c, (tx) =>
        tx.query("select id from content_reports where id=$1", [report]),
      )
    ).rows.length,
    0,
  );
  await assert.rejects(
    asUser(b, (tx) =>
      tx.query("select snapshot from content_reports where id=$1", [report]),
    ),
    /permission denied/,
  );
  await assert.rejects(
    asUser(b, (tx) =>
      tx.query("select review_content_report($1,'remove','')", [report]),
    ),
    /permission denied/,
  );
  await assert.rejects(
    asUser(host, (tx) =>
      tx.query("select submit_content_report('post',$1,'spam','')", [pid]),
    ),
    /own content/,
  );
  await asUser(
    null,
    (tx) =>
      tx.query("select review_content_report($1,'remove','Spam removed')", [
        report,
      ]),
    "service_role",
  );
  assert.equal(
    (
      await asUser(c, (tx) =>
        tx.query("select id from posts where id=$1", [pid]),
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await asUser(b, (tx) =>
        tx.query("select status from content_reports where id=$1", [report]),
      )
    ).rows[0].status,
    "resolved",
  );
});
test("safety: blocking is mutual for new joins, chat creation and raw message sends", async () => {
  const pid = await post(),
    rid = await request(b, pid);
  await asUser(host, (tx) => tx.query("select set_user_block($1,true)", [b]));
  await assert.rejects(
    asUser(host, (tx) => tx.query("select approve_join_request($1)", [rid])),
    /blocked or inactive/,
  );
  assert.equal(
    (
      await asUser(b, (tx) =>
        tx.query("select id from posts where id=$1", [pid]),
      )
    ).rows.length,
    0,
  );
  const nextPost = await post();
  await assert.rejects(
    asUser(b, (tx) => tx.query("select request_join($1)", [nextPost])),
    /blocked or inactive/,
  );
  await asUser(host, (tx) => tx.query("select set_user_block($1,false)", [b]));
  await asUser(host, (tx) =>
    tx.query("select approve_join_request($1)", [rid]),
  );
  const conv = (
    await asUser(b, (tx) =>
      tx.query("select get_or_create_conversation($1,$2,null) as id", [
        host,
        pid,
      ]),
    )
  ).rows[0].id;
  await asUser(b, (tx) => tx.query("select set_user_block($1,true)", [host]));
  await assert.rejects(
    asUser(host, (tx) =>
      tx.query("select get_or_create_conversation($1,$2,null)", [b, pid]),
    ),
    /blocked or inactive/,
  );
  await assert.rejects(
    asUser(host, (tx) =>
      tx.query(
        "insert into messages(conversation_id,sender_id,body) values($1,$2,'Unwanted message')",
        [conv, host],
      ),
    ),
    /blocked or inactive/,
  );
  assert.equal(
    (
      await asUser(b, (tx) =>
        tx.query("select conversation_safety($1) as s", [conv]),
      )
    ).rows[0].s.canMessage,
    false,
  );
  const blockList = (
    await asUser(b, (tx) => tx.query("select list_blocked_users() as items"))
  ).rows[0].items;
  assert.ok(blockList.some((u: any) => u.id === host));
  await asUser(b, (tx) => tx.query("select set_user_block($1,false)", [host]));
});
test("safety: blocking stops new bookings but retains manageable booking history", async () => {
  const owner = await auditBusiness(),
    offer = await auditOffer(owner);
  const booking = (
    await asUser(b, (tx) =>
      tx.query("select book_offer_slot($1,1) as item", [offer.slot]),
    )
  ).rows[0].item;
  await asUser(b, (tx) => tx.query("select set_user_block($1,true)", [owner]));
  assert.equal(
    (
      await asUser(b, (tx) =>
        tx.query("select id from offers where id=$1", [offer.id]),
      )
    ).rows.length,
    1,
  );
  assert.equal(
    (
      await asUser(b, (tx) =>
        tx.query("select id from discovery_offers where id=$1", [offer.id]),
      )
    ).rows.length,
    0,
  );
  await assert.rejects(
    asUser(owner, (tx) =>
      tx.query("select change_booking_status($1,'confirmed')", [
        booking.booking_id,
      ]),
    ),
    /blocked or inactive/,
  );
  await asUser(b, (tx) =>
    tx.query("select change_booking_status($1,'cancelled')", [
      booking.booking_id,
    ]),
  );
  await asUser(b, (tx) => tx.query("select set_user_block($1,false)", [owner]));
});
test("safety: private message reports require membership; block storage cannot be forged", async () => {
  const pid = await post(),
    rid = await request(c, pid);
  await asUser(host, (tx) =>
    tx.query("select approve_join_request($1)", [rid]),
  );
  const conv = (
    await asUser(c, (tx) =>
      tx.query("select get_or_create_conversation($1,$2,null) as id", [
        host,
        pid,
      ]),
    )
  ).rows[0].id;
  const message = (
    await asUser(host, (tx) =>
      tx.query(
        "insert into messages(conversation_id,sender_id,body) values($1,$2,'A reportable message') returning id",
        [conv, host],
      ),
    )
  ).rows[0].id;
  await assert.rejects(
    asUser(outsider, (tx) =>
      tx.query("select submit_content_report('message',$1,'harassment','')", [
        message,
      ]),
    ),
    /not found or not accessible/,
  );
  await asUser(c, (tx) =>
    tx.query("select submit_content_report('message',$1,'harassment','')", [
      message,
    ]),
  );
  await assert.rejects(
    asUser(b, (tx) =>
      tx.query("insert into user_blocks(blocker_id,blocked_id) values($1,$2)", [
        host,
        c,
      ]),
    ),
    /permission denied/,
  );
});
test("deletion: deactivation is immediate, files must be removed first, and Auth deletion cascades", async () => {
  const owner = await auditBusiness();
  await db.query(
    "insert into venues(business_id,name,category,area) values($1,'Deletion test','Sports','Kochi')",
    [owner],
  );
  const offer = await auditOffer(owner);
  await asUser(b, (tx) =>
    tx.query("select book_offer_slot($1,1)", [offer.slot]),
  );
  const path = `${owner}/posts/test.png`;
  await asUser(owner, (tx) =>
    tx.query(
      "insert into storage.objects(bucket_id,name) values('photos',$1)",
      [path],
    ),
  );
  await assert.rejects(
    asUser(owner, (tx) => tx.query("select request_account_deletion('yes')")),
    /Type DELETE/,
  );
  await asUser(owner, (tx) =>
    tx.query("select request_account_deletion('DELETE')"),
  );
  await asUser(owner, (tx) =>
    tx.query("select request_account_deletion('DELETE')"),
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from account_deletion_jobs where user_id=$1",
        [owner],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (await db.query("select account_active($1) as active", [owner])).rows[0]
      .active,
    false,
  );
  assert.equal(
    (await db.query("select status from offers where id=$1", [offer.id]))
      .rows[0].status,
    "ended",
  );
  await assert.rejects(
    asUser(owner, (tx) =>
      tx.query(
        "insert into storage.objects(bucket_id,name) values('photos',$1)",
        [`${owner}/new.png`],
      ),
    ),
    /row-level security/,
  );
  await assert.rejects(
    asUser(owner, (tx) =>
      tx.query(
        "select register_push_token('ExponentPushToken[deleting]','android')",
      ),
    ),
    /Account unavailable/,
  );
  await assert.rejects(
    asUser(owner, (tx) =>
      tx.query("select prepare_auth_deletion($1)", [owner]),
    ),
    /permission denied/,
  );
  await assert.rejects(
    asUser(
      null,
      (tx) => tx.query("select prepare_auth_deletion($1)", [owner]),
      "service_role",
    ),
    /Remove stored files first/,
  );
  await db.query("delete from storage.objects where name=$1", [path]);
  await asUser(
    null,
    (tx) => tx.query("select prepare_auth_deletion($1)", [owner]),
    "service_role",
  );
  const safeNoticesBefore = (
    await db.query(
      "select count(*)::int n from notifications where user_id=$1 and kind='booking_cancelled' and ref_id is null",
      [b],
    )
  ).rows[0].n;
  await asUser(
    null,
    (tx) => tx.query("select prepare_auth_deletion($1)", [owner]),
    "service_role",
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from notifications where user_id=$1 and kind='booking_cancelled' and ref_id is null",
        [b],
      )
    ).rows[0].n,
    safeNoticesBefore,
  );
  assert.ok(safeNoticesBefore > 0);
  await db.query("delete from auth.users where id=$1", [owner]);
  assert.equal(
    (await db.query("select id from profiles where id=$1", [owner])).rows
      .length,
    0,
  );
  assert.equal(
    (await db.query("select id from offers where business_id=$1", [owner])).rows
      .length,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select business_id from venues where name='Deletion test'",
      )
    ).rows[0].business_id,
    null,
  );
  await db.query("delete from account_deletion_jobs where user_id=$1", [owner]);
});
test("notifications: disabling push keeps in-app events while suppressing push jobs", async () => {
  await asUser(c, (tx) => tx.query("select set_push_enabled(false)"));
  const notice = (
    await db.query(
      "insert into notifications(user_id,kind,title,body) values($1,'booking','An update','Open Nearry') returning id",
      [c],
    )
  ).rows[0].id;
  assert.equal(
    (
      await db.query("select id from push_jobs where notification_id=$1", [
        notice,
      ])
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await asUser(c, (tx) =>
        tx.query("select id from notifications where id=$1", [notice]),
      )
    ).rows.length,
    1,
  );
  await assert.rejects(
    asUser(c, (tx) => tx.query("select * from push_deliveries")),
    /permission denied/,
  );
  await assert.rejects(
    asUser(c, (tx) => tx.query("select claim_push_receipts()")),
    /permission denied/,
  );
  await asUser(c, (tx) => tx.query("select set_push_enabled(true)"));
  const consent = await asUser(c, (tx) =>
    tx.query("select accept_community_terms('2026-10-19',true)"),
  );
  assert.ok(consent);
  const acceptedProfile = (
    await asUser(c, (tx) => tx.query("select get_my_profile() as profile"))
  ).rows[0].profile;
  assert.equal(acceptedProfile.terms_version, "2026-10-19");
  assert.ok(Number.isFinite(Date.parse(acceptedProfile.terms_accepted_at)));
  await assert.rejects(
    asUser(c, (tx) =>
      tx.query("select accept_community_terms('2026-10-19',false)"),
    ),
    /confirm your age/,
  );
  await assert.rejects(
    asUser(c, (tx) => tx.query("select accept_community_terms('old',true)")),
    /current terms/,
  );
});

test("moderation: removing a reported photo hides metadata and queues its owned storage object", async () => {
  const pid = await post();
  const path = `${host}/posts/reported.png`;
  const photo = (
    await asUser(host, (tx) =>
      tx.query(
        "insert into post_photos(post_id,photo_url) values($1,$2) returning id",
        [
          pid,
          `https://project.example/storage/v1/object/public/photos/${path}`,
        ],
      ),
    )
  ).rows[0];
  const report = (
    await asUser(b, (tx) =>
      tx.query(
        "select submit_content_report('photo',$1,'inappropriate','') as id",
        [photo.id],
      ),
    )
  ).rows[0].id;
  await asUser(
    null,
    (tx) =>
      tx.query("select review_content_report($1,'remove','Photo removed')", [
        report,
      ]),
    "service_role",
  );
  assert.equal(
    (await db.query("select id from post_photos where id=$1", [photo.id])).rows
      .length,
    0,
  );
  assert.equal(
    (
      await db.query("select path from media_cleanup_jobs where path=$1", [
        path,
      ])
    ).rows[0].path,
    path,
  );
});

async function chatFixture() {
  const owner = await corePersonal(),
    member = await corePersonal();
  const pid = (
    await db.query(
      "insert into posts(author_id,title,description,starts_at,vacancies,venue_id) values($1,'Chat test','A private chat for regression tests',now()+interval '4 hours',2,'10000000-0000-0000-0000-000000000032') returning id",
      [owner],
    )
  ).rows[0].id;
  const rid = await request(member, pid);
  await asUser(owner, (tx) =>
    tx.query("select approve_join_request($1)", [rid]),
  );
  const conv = (
    await asUser(member, (tx) =>
      tx.query("select get_or_create_conversation($1,$2,null) id", [
        owner,
        pid,
      ]),
    )
  ).rows[0].id;
  const send = (sender: string, body: string) =>
    asUser(sender, (tx) =>
      tx.query(
        "insert into messages(conversation_id,sender_id,body) values($1,$2,$3) returning id",
        [conv, sender, body],
      ),
    );
  const inbox = async (user: string) =>
    (
      await asUser(user, (tx) =>
        tx.query("select list_my_conversations() result"),
      )
    ).rows[0].result.find((row: any) => row.id === conv);
  const history = async (user: string) =>
    (
      await asUser(user, (tx) =>
        tx.query(
          "select body from messages where conversation_id=$1 order by created_at,id",
          [conv],
        ),
      )
    ).rows.map((m: any) => m.body);
  return { owner, member, conv, send, inbox, history };
}

test("chat deletion clears only the member's inbox/history and new messages revive a clean chat", async () => {
  const f = await chatFixture();
  await f.send(f.owner, "Old incoming message");
  await f.send(f.member, "Old reply");
  const before = Number(
    (await asUser(f.member, (tx) => tx.query("select unread_counts() counts")))
      .rows[0].counts.messages,
  );
  await asUser(f.member, (tx) =>
    tx.query("select delete_my_conversation($1)", [f.conv]),
  );
  assert.equal(await f.inbox(f.member), undefined);
  assert.ok(await f.inbox(f.owner));
  assert.deepEqual(await f.history(f.member), []);
  assert.deepEqual(await f.history(f.owner), [
    "Old incoming message",
    "Old reply",
  ]);
  assert.equal(
    Number(
      (
        await asUser(f.member, (tx) =>
          tx.query("select unread_counts() counts"),
        )
      ).rows[0].counts.messages,
    ),
    before - 1,
  );
  assert.equal(
    Number(
      (
        await db.query(
          "select count(*)::int n from notifications where user_id=$1 and ref_id=$2 and kind='message' and read_at is null",
          [f.member, f.conv],
        )
      ).rows[0].n,
    ),
    0,
  );
  await f.send(f.owner, "New incoming message");
  assert.deepEqual(await f.history(f.member), ["New incoming message"]);
  assert.equal((await f.inbox(f.member)).last_body, "New incoming message");
  assert.equal(Number((await f.inbox(f.member)).unread_count), 1);
  assert.equal((await f.history(f.owner)).length, 3);
  await asUser(f.owner, (tx) =>
    tx.query("select delete_my_conversation($1)", [f.conv]),
  );
  assert.deepEqual(await f.history(f.owner), []);
  assert.deepEqual(await f.history(f.member), ["New incoming message"]);
  await f.send(f.member, "New outgoing message");
  assert.deepEqual(await f.history(f.owner), ["New outgoing message"]);
  assert.deepEqual(await f.history(f.member), [
    "New incoming message",
    "New outgoing message",
  ]);
});

test("chat deletion validates membership and rejects forged clear boundaries", async () => {
  const f = await chatFixture();
  await assert.rejects(
    asUser(outsider, (tx) =>
      tx.query("select delete_my_conversation($1)", [f.conv]),
    ),
    /not a conversation member/,
  );
  await assert.rejects(
    asUser(
      null,
      (tx) => tx.query("select delete_my_conversation($1)", [f.conv]),
      "anon",
    ),
    /permission denied/,
  );
  await assert.rejects(
    asUser(f.member, (tx) =>
      tx.query(
        "insert into conversation_clears(conversation_id,user_id,cleared_at) values($1,$2,now()+interval '1 year')",
        [f.conv, f.member],
      ),
    ),
    /permission denied/,
  );
  await asUser(f.member, (tx) =>
    tx.query("select delete_my_conversation($1)", [f.conv]),
  );
  assert.equal(await f.inbox(f.member), undefined); // empty chats can also be deleted
  assert.equal(
    (
      await asUser(f.owner, (tx) =>
        tx.query("select * from conversation_clears where conversation_id=$1", [
          f.conv,
        ]),
      )
    ).rows.length,
    0,
  );
  await asUser(f.member, (tx) =>
    tx.query("delete from conversation_clears where conversation_id=$1", [
      f.conv,
    ]),
  ).then(
    () => assert.fail("raw delete allowed"),
    (e) => assert.match(e.message, /permission denied/),
  );
  await asUser(f.member, (tx) =>
    tx.query("select delete_my_conversation($1)", [f.conv]),
  ); // safe repeat
  await db.query("delete from conversations where id=$1", [f.conv]);
  assert.equal(
    (
      await db.query(
        "select * from conversation_clears where conversation_id=$1",
        [f.conv],
      )
    ).rows.length,
    0,
  );
});

test("conversation reports protect private history and retain a deduplicated moderation snapshot", async () => {
  const f = await chatFixture();
  await f.send(f.owner, "Message that needs review");
  await f.send(f.member, "My context");
  await assert.rejects(
    asUser(outsider, (tx) =>
      tx.query(
        "select submit_content_report('conversation',$1,'harassment','')",
        [f.conv],
      ),
    ),
    /not found or not accessible/,
  );
  const report = (
    await asUser(f.member, (tx) =>
      tx.query(
        "select submit_content_report('conversation',$1,'harassment','Concern in this chat') id",
        [f.conv],
      ),
    )
  ).rows[0].id;
  const repeated = (
    await asUser(f.member, (tx) =>
      tx.query(
        "select submit_content_report('conversation',$1,'spam','Retry') id",
        [f.conv],
      ),
    )
  ).rows[0].id;
  assert.equal(report, repeated);
  const row = (
    await db.query("select * from content_reports where id=$1", [report])
  ).rows[0];
  assert.equal(row.subject_user_id, f.owner);
  assert.match(row.snapshot, /Message that needs review/);
  assert.match(row.snapshot, /My context/);
  assert.equal(
    (
      await asUser(f.owner, (tx) =>
        tx.query("select id from content_reports where id=$1", [report]),
      )
    ).rows.length,
    0,
  );
  await asUser(f.member, (tx) =>
    tx.query("select delete_my_conversation($1)", [f.conv]),
  );
  assert.match(
    (
      await db.query("select snapshot from content_reports where id=$1", [
        report,
      ])
    ).rows[0].snapshot,
    /Message that needs review/,
  );
  await assert.rejects(
    asUser(
      null,
      (tx) =>
        tx.query("select review_content_report($1,'remove','')", [report]),
      "service_role",
    ),
    /specific message/,
  );
  await asUser(
    null,
    (tx) =>
      tx.query(
        "select review_content_report($1,'suspend','Reviewed concern')",
        [report],
      ),
    "service_role",
  );
  assert.equal(
    (await db.query("select status from content_reports where id=$1", [report]))
      .rows[0].status,
    "resolved",
  );
  assert.equal(await f.inbox(f.member), undefined); // inactive peers remain filtered
});

test("participation: Google-style incomplete accounts can browse but must supply age/gender before creating or joining", async () => {
  const user = (await db.query("select gen_random_uuid() id")).rows[0].id;
  await db.query(
    'insert into auth.users(id,email,raw_user_meta_data) values($1,\'new-google@test.example\',\'{"account_type":"personal","full_name":"Google Neighbour"}\')',
    [user],
  );
  const pid = await post();
  assert.equal(
    (
      await asUser(user, (tx) =>
        tx.query("select id from post_cards where id=$1", [pid]),
      )
    ).rows.length,
    1,
  );
  await assert.rejects(
    asUser(user, (tx) => tx.query("select request_join($1)", [pid])),
    /onboarding|profile/i,
  );
  await assert.rejects(
    asUser(user, (tx) =>
      tx.query(
        "insert into posts(author_id,title,description,starts_at,vacancies,venue_id) values($1,'My first plan','A friendly first plan',now()+interval '4 hours',2,'10000000-0000-0000-0000-000000000032')",
        [user],
      ),
    ),
    /onboarding|row-level security|profile/i,
  );
  await assert.rejects(
    asUser(user, (tx) =>
      tx.query(
        "select complete_personal_profile('New Person','female',17,true)",
      ),
    ),
    /18 and 100/,
  );
  await assert.rejects(
    asUser(user, (tx) =>
      tx.query("select complete_personal_profile('New Person',null,25,true)"),
    ),
    /name, gender/,
  );
  await assert.rejects(
    asUser(user, (tx) =>
      tx.query(
        "select complete_personal_profile('New Person','female',25,false)",
      ),
    ),
    /accept/,
  );
  await asUser(user, (tx) =>
    tx.query("select complete_personal_profile('New Person','female',25,true)"),
  );
  const own = (
    await asUser(user, (tx) => tx.query("select get_my_profile() p"))
  ).rows[0].p;
  assert.equal(own.age, 25);
  assert.equal(own.gender, "female");
  assert.equal(own.onboarding_completed, true);
  await assert.rejects(
    asUser(host, (tx) =>
      tx.query("select age from profiles where id=$1", [user]),
    ),
    /permission denied/,
  );
  await assert.rejects(
    asUser(host, (tx) => tx.query("select personal_profile_ready($1)", [user])),
    /permission denied/,
  );
  await assert.rejects(
    asUser(
      null,
      (tx) =>
        tx.query("select complete_personal_profile('Person','female',25,true)"),
      "anon",
    ),
    /permission denied/,
  );
  await request(user, pid);
  await asUser(user, (tx) =>
    tx.query(
      "insert into posts(author_id,title,description,starts_at,vacancies,venue_id) values($1,'My first plan','A friendly first plan',now()+interval '4 hours',2,'10000000-0000-0000-0000-000000000032')",
      [user],
    ),
  );
  // An old onboarding flag alone cannot bypass the new required details.
  await asUser(user, (tx) =>
    tx.query("update profiles set age=null where id=$1", [user]),
  );
  await assert.rejects(
    asUser(user, (tx) =>
      tx.query(
        "insert into posts(author_id,title,description,starts_at,vacancies,venue_id) values($1,'Bypass attempt','A friendly first plan',now()+interval '4 hours',2,'10000000-0000-0000-0000-000000000032')",
        [user],
      ),
    ),
    /row-level security/,
  );
});

test("post_cards preserves the published audience for detail, feed, My posts and subsequent edits", async () => {
  // The fixture was inserted before migration 00028, with the stale view.
  const existing = (
    await db.query(
      "select p.gender_preference as stored,c.gender_preference as displayed from posts p join post_cards c using(id) where p.id='10000000-0000-0000-0000-000000000028'",
    )
  ).rows[0];
  assert.deepEqual(existing, { stored: "female", displayed: "female" });
  const owner = await corePersonal(),
    viewer = await corePersonal();
  for (const audience of ["female", "male", "any"] as const) {
    const saved = (
      await asUser(owner, (tx) =>
        tx.query(
          "insert into posts(author_id,title,description,starts_at,vacancies,gender_preference,venue_id) values($1,'Audience roundtrip','Keep the selected audience after publishing',now()+interval '4 hours',4,$2,'10000000-0000-0000-0000-000000000032') returning id,gender_preference",
          [owner, audience],
        ),
      )
    ).rows[0];
    assert.equal(saved.gender_preference, audience);
    for (const reader of [owner, viewer]) {
      const detail = (
        await asUser(reader, (tx) =>
          tx.query("select * from post_cards where id=$1", [saved.id]),
        )
      ).rows[0];
      assert.equal(detail.gender_preference, audience);
      assert.equal(detail.approved_count, 0);
      const feed = (
        await asUser(reader, (tx) =>
          tx.query(
            "select * from post_cards where author_id=$1 and status='open'",
            [owner],
          ),
        )
      ).rows.find((row: any) => row.id === saved.id);
      assert.equal(feed.gender_preference, audience);
    }
    const changed = audience === "female" ? "male" : "female";
    await asUser(owner, (tx) =>
      tx.query("update posts set gender_preference=$2 where id=$1", [
        saved.id,
        changed,
      ]),
    );
    const edited = (
      await asUser(viewer, (tx) =>
        tx.query("select * from post_cards where id=$1", [saved.id]),
      )
    ).rows[0];
    assert.equal(edited.gender_preference, changed);
  }
  const legacy = await post();
  assert.equal(
    (
      await asUser(viewer, (tx) =>
        tx.query("select gender_preference from post_cards where id=$1", [
          legacy,
        ]),
      )
    ).rows[0].gender_preference,
    null,
  );
  assert.deepEqual(
    (
      await db.query(
        "select reloptions from pg_class where oid='public.post_cards'::regclass",
      )
    ).rows[0].reloptions,
    ["security_invoker=true"],
  );
});

test("audience: requests and approvals enforce gender; Anyone includes Other; audience edits preserve approved participants", async () => {
  const owner = await corePersonal(),
    woman = await corePersonal(),
    man = await corePersonal(),
    other = await corePersonal();
  await db.query("update profiles set gender='female' where id=$1", [woman]);
  await db.query("update profiles set gender='other' where id=$1", [other]);
  const pid = (
    await db.query(
      "insert into posts(author_id,title,description,starts_at,vacancies,gender_preference,venue_id) values($1,'Women’s game','A friendly game for women',now()+interval '4 hours',4,'female','10000000-0000-0000-0000-000000000032') returning id",
      [owner],
    )
  ).rows[0].id;
  await assert.rejects(request(man, pid), /females only/);
  await assert.rejects(request(other, pid), /females only/);
  const wr = await request(woman, pid);
  await db.query("update profiles set gender='male' where id=$1", [woman]);
  await assert.rejects(
    asUser(owner, (tx) => tx.query("select approve_join_request($1)", [wr])),
    /females only/,
  );
  await db.query("update profiles set gender='female' where id=$1", [woman]);
  await asUser(owner, (tx) =>
    tx.query("select approve_join_request($1)", [wr]),
  );
  await assert.rejects(
    asUser(owner, (tx) =>
      tx.query("update posts set gender_preference='male' where id=$1", [pid]),
    ),
    /Approved participants/,
  );
  await asUser(owner, (tx) =>
    tx.query("update posts set gender_preference='any' where id=$1", [pid]),
  );
  const mr = await request(man, pid),
    or = await request(other, pid);
  await asUser(owner, (tx) =>
    tx.query("update posts set gender_preference='female' where id=$1", [pid]),
  );
  const affected = (
    await db.query(
      "select id,status,decline_count from join_requests where id=any($1::uuid[])",
      [[mr, or]],
    )
  ).rows;
  assert(
    affected.every(
      (row: any) => row.status === "declined" && row.decline_count === 0,
    ),
  );
  await asUser(owner, (tx) =>
    tx.query("update posts set gender_preference='any' where id=$1", [pid]),
  );
  await request(other, pid);
  const men = (
    await db.query(
      "insert into posts(author_id,title,description,starts_at,vacancies,gender_preference,venue_id) values($1,'Men’s game','A friendly game for men',now()+interval '4 hours',2,'male','10000000-0000-0000-0000-000000000032') returning id",
      [owner],
    )
  ).rows[0].id;
  await request(man, men);
  await assert.rejects(request(woman, men), /males only/);
});

test("photos: atomic edit keeps existing photos on failure, validates ownership, and changes order and cover without replacing retained IDs", async () => {
  const owner = await corePersonal(),
    pid = (
      await db.query(
        "insert into posts(author_id,title,description,starts_at,vacancies,venue_id) values($1,'Photo edit','A photo editing regression',now()+interval '4 hours',2,'10000000-0000-0000-0000-000000000032') returning id",
        [owner],
      )
    ).rows[0].id;
  const path = (suffix: string) => `${owner}/posts/${suffix}.jpg`;
  const url = (suffix: string) =>
    `https://photos.test/storage/v1/object/public/photos/${path(suffix)}`;
  for (const suffix of ["first", "second", "third"])
    await db.query(
      "insert into storage.objects(bucket_id,name)values('photos',$1)",
      [path(suffix)],
    );
  await asUser(owner, (tx) =>
    tx.query("select set_post_photos($1,$2)", [
      pid,
      [url("first"), url("second")],
    ]),
  );
  const before = (
    await db.query(
      "select id,photo_url,sort_order from post_photos where post_id=$1 order by sort_order",
      [pid],
    )
  ).rows;
  await assert.rejects(
    asUser(outsider, (tx) =>
      tx.query("select set_post_photos($1,$2)", [pid, []]),
    ),
    /active host/,
  );
  await assert.rejects(
    asUser(owner, (tx) =>
      tx.query("select set_post_photos($1,$2)", [
        pid,
        [url("third"), url("missing")],
      ]),
    ),
    /Upload your own/,
  );
  assert.deepEqual(
    (
      await db.query(
        "select id,photo_url,sort_order from post_photos where post_id=$1 order by sort_order",
        [pid],
      )
    ).rows,
    before,
  );
  await assert.rejects(
    asUser(owner, (tx) =>
      tx.query("select set_post_photos($1,$2)", [
        pid,
        [url("first"), url("first")],
      ]),
    ),
    /different photos/,
  );
  await assert.rejects(
    asUser(owner, (tx) =>
      tx.query("select set_post_photos($1,$2)", [
        pid,
        [
          "https://fake.test/a",
          "https://fake.test/b",
          "https://fake.test/c",
          "https://fake.test/d",
          "https://fake.test/e",
          "https://fake.test/f",
        ],
      ]),
    ),
    /5 different/,
  );
  await asUser(owner, (tx) =>
    tx.query("select set_post_photos($1,$2)", [
      pid,
      [url("third"), url("second")],
    ]),
  );
  const after = (
    await db.query(
      "select id,photo_url,sort_order from post_photos where post_id=$1 order by sort_order",
      [pid],
    )
  ).rows;
  assert.equal(after.length, 2);
  assert.equal(after[0].photo_url, url("third"));
  assert.equal(after[1].id, before[1].id);
  await asUser(owner, (tx) =>
    tx.query("select set_post_photos($1,$2)", [
      pid,
      [url("third"), url("second")],
    ]),
  );
  assert.deepEqual(
    (
      await db.query(
        "select id,photo_url,sort_order from post_photos where post_id=$1 order by sort_order",
        [pid],
      )
    ).rows,
    after,
  );
  await asUser(owner, (tx) =>
    tx.query("select set_post_photos($1,$2)", [pid, []]),
  );
  assert.equal(
    (await db.query("select id from post_photos where post_id=$1", [pid])).rows
      .length,
    0,
  );
});

test("admin dashboard rejects client actions and atomically audits trusted moderation", async () => {
  const reportId = (
    await db.query(
      "insert into content_reports(reporter_id,subject_user_id,target_kind,target_id,reason,details,snapshot) values($1,$2,'user',gen_random_uuid(),'spam','test','evidence') returning id",
      [host, b],
    )
  ).rows[0].id;
  const sql =
    "select admin_console_decide($1,'report',$2,'dismiss','reviewed in test')";
  await assert.rejects(
    asUser(host, (tx) => tx.query(sql, [host, reportId])),
    /permission denied/,
  );
  await assert.rejects(
    asUser(null, (tx) => tx.query(sql, [host, reportId]), "service_role"),
    /admin not authorized/,
  );
  await db.query(
    "insert into admin_console_members(user_id,role) values($1,'owner')",
    [host],
  );
  await asUser(null, (tx) => tx.query(sql, [host, reportId]), "service_role");
  assert.equal(
    (
      await db.query("select status from content_reports where id=$1", [
        reportId,
      ])
    ).rows[0].status,
    "dismissed",
  );
  const audit = (
    await db.query(
      "select actor_id,action from admin_console_audit where target_id=$1",
      [reportId],
    )
  ).rows;
  assert.equal(audit.length, 1);
  assert.equal(audit[0].actor_id, host);
  assert.equal(audit[0].action, "report:dismiss");
});

test("admin: business review queue, old requests, decisions and audit use current documents and private service access", async () => {
  const owner = await corePersonal();
  await db.query(
    "insert into admin_console_members(user_id,role) values($1,'owner')",
    [owner],
  );
  const makeBusiness = async (name: string) => {
    const id = (await db.query("select gen_random_uuid() id")).rows[0].id;
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,'admin-review@test.example','{\"account_type\":\"business\"}')",
      [id],
    );
    const path = `${id}/current-proof.jpg`;
    await db.query(
      "insert into storage.objects(bucket_id,name) values('verification_docs',$1)",
      [path],
    );
    await db.query(
      'update profiles set display_name=$2,business_name=$2,business_details=\'{"category":"cafe","area":"Kochi"}\',verification_status=\'pending\',verification_doc_path=$3 where id=$1',
      [id, name, path],
    );
    const review = (
      await db.query(
        "select id from verification_review_jobs where user_id=$1 and reviewed_at is null",
        [id],
      )
    ).rows[0].id;
    return { id, review, path };
  };
  const business = await makeBusiness("Older cafe request");
  await db.query(
    "update verification_review_jobs set created_at=now()-interval '14 days' where id=$1",
    [business.review],
  );
  const call = (id: string, decision = "approved", note = "") =>
    asUser(
      null,
      (tx) =>
        tx.query("select admin_console_decide($1,'business',$2,$3,$4)", [
          owner,
          id,
          decision,
          note,
        ]),
      "service_role",
    );
  const overview = await asUser(
    null,
    (tx) => tx.query("select admin_console_overview() result"),
    "service_role",
  );
  assert(overview.rows[0].result.users > 0);
  assert(overview.rows[0].result.pendingBusinessReviews > 0);
  const queue = (
    await asUser(
      null,
      (tx) => tx.query("select * from admin_console_business_queue(0,100)"),
      "service_role",
    )
  ).rows;
  assert.equal(
    queue.find((r: any) => r.id === business.review).business_name,
    "Older cafe request",
  );
  for (const role of ["anon", "authenticated"]) {
    await assert.rejects(
      asUser(owner, (tx) => tx.query("select admin_console_overview()"), role),
      /permission denied/,
    );
    await assert.rejects(
      asUser(
        owner,
        (tx) => tx.query("select * from admin_console_business_queue()"),
        role,
      ),
      /permission denied/,
    );
    await assert.rejects(
      asUser(
        owner,
        (tx) => tx.query("select * from admin_console_members"),
        role,
      ),
      /permission denied/,
    );
  }
  // The old emailed link remains expired; an authenticated admin can still act.
  await assert.rejects(
    asUser(
      null,
      (tx) =>
        tx.query("select review_verification($1,'approved','')", [
          business.review,
        ]),
      "service_role",
    ),
    /expired/,
  );
  await call(business.review);
  assert.equal(
    (
      await db.query("select verification_status from profiles where id=$1", [
        business.id,
      ])
    ).rows[0].verification_status,
    "verified",
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from admin_console_audit where target_id=$1",
        [business.review],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from notifications where user_id=$1 and kind='verification_approved'",
        [business.id],
      )
    ).rows[0].n,
    1,
  );
  await assert.rejects(call(business.review), /already completed/);
  const rejection = await makeBusiness("Rejected cafe");
  await assert.rejects(call(rejection.review, "rejected"), /reason required/);
  await call(
    rejection.review,
    "rejected",
    "Business name does not match the proof",
  );
  assert.equal(
    (
      await db.query("select verification_note from profiles where id=$1", [
        rejection.id,
      ])
    ).rows[0].verification_note,
    "Business name does not match the proof",
  );
  const stale = await makeBusiness("Changed document");
  await db.query("update profiles set verification_doc_path=$2 where id=$1", [
    stale.id,
    `${stale.id}/new-proof.jpg`,
  ]);
  await assert.rejects(call(stale.review), /stale/);
  await db.query(
    "update admin_console_members set revoked_at=now() where user_id=$1",
    [owner],
  );
  const waiting = await makeBusiness("Waiting cafe");
  await assert.rejects(call(waiting.review), /admin not authorized/);
  assert.equal(
    (
      await db.query("select verification_status from profiles where id=$1", [
        waiting.id,
      ])
    ).rows[0].verification_status,
    "pending",
  );
});

async function selfieApplicant() {
  const id = await corePersonal();
  const avatar = `${id}/avatar-00000000-0000-0000-0000-000000000001.jpg`,
    path = `${id}/selfie-original.jpg`;
  const url = `https://project.supabase.co/storage/v1/object/public/avatars/${avatar}`;
  await asUser(id, (tx) =>
    tx.query(
      "insert into storage.objects(bucket_id,name)values('avatars',$1),('selfie_proofs',$2)",
      [avatar, path],
    ),
  );
  await asUser(id, (tx) =>
    tx.query("update profiles set avatar_url=$2 where id=$1", [id, url]),
  );
  return { id, avatar, path, url };
}
async function submitSelfie(id: string, path: string) {
  await asUser(id, (tx) =>
    tx.query("select submit_personal_selfie($1,true)", [path]),
  );
  return (
    await db.query(
      "select submission_id from personal_selfie_reviews where user_id=$1",
      [id],
    )
  ).rows[0].submission_id;
}
const checkedSelfie = async (id: string) =>
  (
    await asUser(id, (tx) =>
      tx.query("select is_personal_selfie_checked($1) checked", [id]),
    )
  ).rows[0].checked;

test("selfies: private owner-only media/status and service-only verdicts; pinned images cannot be replaced or deleted", async () => {
  const p = await selfieApplicant(),
    other = await corePersonal();
  const bucket = (
    await db.query(
      "select public,file_size_limit,allowed_mime_types from storage.buckets where id='selfie_proofs'",
    )
  ).rows[0];
  assert.equal(bucket.public, false);
  assert.equal(Number(bucket.file_size_limit), 5242880);
  assert.deepEqual(bucket.allowed_mime_types, [
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);
  await assert.rejects(
    asUser(p.id, (tx) =>
      tx.query("select submit_personal_selfie($1,false)", [p.path]),
    ),
    /agree/,
  );
  await assert.rejects(
    asUser(other, (tx) =>
      tx.query("select submit_personal_selfie($1,true)", [p.path]),
    ),
    /profile photo/,
  );
  const submission = await submitSelfie(p.id, p.path);
  assert.equal(await checkedSelfie(p.id), false);
  for (const role of ["anon", "authenticated"]) {
    await assert.rejects(
      asUser(
        p.id,
        (tx) =>
          tx.query("select review_personal_selfie($1,$2,'verified','')", [
            p.id,
            submission,
          ]),
        role,
      ),
      /permission denied/,
    );
    await assert.rejects(
      asUser(
        p.id,
        (tx) => tx.query("select * from admin_console_selfie_queue()"),
        role,
      ),
      /permission denied/,
    );
  }
  await assert.rejects(
    asUser(p.id, (tx) =>
      tx.query("select selfie_path from personal_selfie_reviews"),
    ),
    /permission denied/,
  );
  assert.equal(
    (
      await asUser(p.id, (tx) =>
        tx.query("select status,note from personal_selfie_reviews"),
      )
    ).rows.length,
    1,
  );
  assert.equal(
    (
      await asUser(other, (tx) =>
        tx.query(
          "select status from personal_selfie_reviews where user_id=$1",
          [p.id],
        ),
      )
    ).rows.length,
    0,
  );
  await assert.rejects(
    asUser(p.id, (tx) =>
      tx.query(
        "update personal_selfie_reviews set status='verified' where user_id=$1",
        [p.id],
      ),
    ),
    /permission denied/,
  );
  for (const id of [other, null]) {
    const role = id ? "authenticated" : "anon";
    assert.equal(
      (
        await asUser(
          id,
          (tx) =>
            tx.query(
              "select name from storage.objects where bucket_id='selfie_proofs' and name=$1",
              [p.path],
            ),
          role,
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await asUser(
          id,
          (tx) =>
            tx.query(
              "delete from storage.objects where bucket_id='selfie_proofs' and name=$1 returning name",
              [p.path],
            ),
          role,
        )
      ).rows.length,
      0,
    );
  }
  await assert.rejects(
    asUser(other, (tx) =>
      tx.query(
        "insert into storage.objects(bucket_id,name)values('selfie_proofs',$1)",
        [`${p.id}/selfie-forged.jpg`],
      ),
    ),
    /row.level security/,
  );
  for (const [bucket, path] of [
    ["avatars", p.avatar],
    ["selfie_proofs", p.path],
  ]) {
    assert.equal(
      (
        await asUser(p.id, (tx) =>
          tx.query(
            "update storage.objects set name=name where bucket_id=$1 and name=$2 returning id",
            [bucket, path],
          ),
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await asUser(p.id, (tx) =>
          tx.query(
            "delete from storage.objects where bucket_id=$1 and name=$2 returning id",
            [bucket, path],
          ),
        )
      ).rows.length,
      0,
    );
  }
  await assert.rejects(
    asUser(p.id, (tx) =>
      tx.query(
        "insert into storage.objects(bucket_id,name)values('selfie_proofs',$1)",
        [`${p.id}/selfie-second.jpg`],
      ),
    ),
    /row.level security/,
  );
  await assert.rejects(submitSelfie(p.id, p.path), /already pending/);
});

test("selfies: audited approval is atomic, one-time, submission-specific and invalidated by avatar change", async () => {
  const p = await selfieApplicant(),
    owner = await corePersonal();
  await db.query(
    "insert into admin_console_members(user_id,role)values($1,'owner')",
    [owner],
  );
  const submission = await submitSelfie(p.id, p.path);
  const decide = (id: string, decision = "verified", note = "") =>
    asUser(
      null,
      (tx) =>
        tx.query("select admin_console_decide($1,'selfie',$2,$3,$4)", [
          owner,
          id,
          decision,
          note,
        ]),
      "service_role",
    );
  const queue = (
    await asUser(
      null,
      (tx) => tx.query("select * from admin_console_selfie_queue(0,100)"),
      "service_role",
    )
  ).rows;
  assert.equal(queue.find((r: any) => r.id === submission)?.user_id, p.id);
  assert.equal(
    "selfie_path" in queue.find((r: any) => r.id === submission),
    false,
  );
  await assert.rejects(decide(submission, "rejected", ""), /reason required/);
  await decide(submission);
  assert.equal(await checkedSelfie(p.id), true);
  const review = (
    await db.query(
      "select status,selfie_path from personal_selfie_reviews where user_id=$1",
      [p.id],
    )
  ).rows[0];
  assert.equal(review.status, "verified");
  assert.equal(review.selfie_path, null);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from media_cleanup_jobs where bucket='selfie_proofs' and path=$1",
        [p.path],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from notifications where user_id=$1 and kind='selfie_review'",
        [p.id],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from admin_console_audit where action='selfie:verified' and target_id=$1",
        [submission],
      )
    ).rows[0].n,
    1,
  );
  await assert.rejects(decide(submission), /unavailable/);
  // An owner cannot delete/reinsert the approved avatar to replace its bytes.
  assert.equal(
    (
      await asUser(p.id, (tx) =>
        tx.query(
          "delete from storage.objects where bucket_id='avatars' and name=$1 returning name",
          [p.avatar],
        ),
      )
    ).rows.length,
    0,
  );
  const nextAvatar = `${p.id}/avatar-00000000-0000-0000-0000-000000000002.jpg`,
    nextPath = `${p.id}/selfie-new.jpg`;
  await asUser(p.id, (tx) =>
    tx.query(
      "insert into storage.objects(bucket_id,name)values('avatars',$1)",
      [nextAvatar],
    ),
  );
  await asUser(p.id, (tx) =>
    tx.query("update profiles set avatar_url=$2 where id=$1", [
      p.id,
      `https://project.supabase.co/storage/v1/object/public/avatars/${nextAvatar}`,
    ]),
  );
  assert.equal(await checkedSelfie(p.id), false);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from media_cleanup_jobs where bucket='avatars' and path=$1",
        [p.avatar],
      )
    ).rows[0].n,
    1,
  );
  await db.query(
    "update personal_selfie_reviews set submitted_at=now()-interval '3 minutes' where user_id=$1",
    [p.id],
  );
  await asUser(p.id, (tx) =>
    tx.query(
      "insert into storage.objects(bucket_id,name)values('selfie_proofs',$1)",
      [nextPath],
    ),
  );
  const next = await submitSelfie(p.id, nextPath);
  assert.notEqual(next, submission);
  await assert.rejects(decide(submission), /unavailable/);
  await decide(
    next,
    "rejected",
    "Please use a clear photo without sunglasses.",
  );
  assert.equal(await checkedSelfie(p.id), false);
  assert.equal(
    (
      await asUser(p.id, (tx) =>
        tx.query("select note from personal_selfie_reviews where user_id=$1", [
          p.id,
        ]),
      )
    ).rows[0].note,
    "Please use a clear photo without sunglasses.",
  );
});

test("selfies: cancellation, avatar replacement, expiry and orphan retention queue private files for the existing worker", async () => {
  const p = await selfieApplicant();
  await submitSelfie(p.id, p.path);
  await asUser(p.id, (tx) => tx.query("select withdraw_personal_selfie()"));
  assert.equal(await checkedSelfie(p.id), false);
  assert.equal(
    (
      await db.query(
        "select status,selfie_path from personal_selfie_reviews where user_id=$1",
        [p.id],
      )
    ).rows[0].status,
    "unverified",
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from media_cleanup_jobs where path=$1",
        [p.path],
      )
    ).rows[0].n,
    1,
  );
  const q = await selfieApplicant();
  const version = await submitSelfie(q.id, q.path);
  await asUser(q.id, (tx) =>
    tx.query("update profiles set avatar_url=null where id=$1", [q.id]),
  );
  await assert.rejects(
    asUser(
      null,
      (tx) =>
        tx.query("select review_personal_selfie($1,$2,'verified','')", [
          q.id,
          version,
        ]),
      "service_role",
    ),
    /unavailable/,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from media_cleanup_jobs where path=$1",
        [q.path],
      )
    ).rows[0].n,
    1,
  );
  const expired = await selfieApplicant();
  const expiredVersion = await submitSelfie(expired.id, expired.path);
  await db.query(
    "update personal_selfie_reviews set submitted_at=now()-interval '8 days' where user_id=$1",
    [expired.id],
  );
  await assert.rejects(
    asUser(
      null,
      (tx) =>
        tx.query("select review_personal_selfie($1,$2,'verified','')", [
          expired.id,
          expiredVersion,
        ]),
      "service_role",
    ),
    /expired/,
  );
  const orphan = await selfieApplicant();
  await db.query(
    "update storage.objects set created_at=now()-interval '25 hours' where bucket_id='selfie_proofs' and name=$1",
    [orphan.path],
  );
  await asUser(
    null,
    (tx) => tx.query("select maintenance_retention_cleanup()"),
    "service_role",
  );
  assert.equal(
    (
      await db.query(
        "select status,selfie_path from personal_selfie_reviews where user_id=$1",
        [expired.id],
      )
    ).rows[0].status,
    "rejected",
  );
  for (const path of [expired.path, orphan.path])
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from media_cleanup_jobs where path=$1",
          [path],
        )
      ).rows[0].n,
      1,
    );
  const deleting = await selfieApplicant();
  await submitSelfie(deleting.id, deleting.path);
  await asUser(deleting.id, (tx) =>
    tx.query("select request_account_deletion('DELETE')"),
  );
  const files = (
    await asUser(
      null,
      (tx) =>
        tx.query("select deletion_storage_batch($1) files", [deleting.id]),
      "service_role",
    )
  ).rows[0].files;
  assert(
    files.some(
      (f: any) => f.bucket === "selfie_proofs" && f.path === deleting.path,
    ),
  );
  assert.equal(await checkedSelfie(deleting.id), false);
});

test("selfies: owned avatars, profile readiness, missing media and server submission limits are enforced", async () => {
  const p = await selfieApplicant();
  await db.query("update profiles set age=null where id=$1", [p.id]);
  await assert.rejects(submitSelfie(p.id, p.path), /Complete your profile/);
  await db.query("update profiles set age=25 where id=$1", [p.id]);
  await assert.rejects(
    submitSelfie(p.id, `${p.id}/selfie-missing.jpg`),
    /invalid private selfie/,
  );
  const submission = await submitSelfie(p.id, p.path);
  await db.query(
    "delete from storage.objects where bucket_id='avatars' and name=$1",
    [p.avatar],
  );
  assert.equal(await checkedSelfie(p.id), false);
  await assert.rejects(
    asUser(
      null,
      (tx) =>
        tx.query("select review_personal_selfie($1,$2,'verified','')", [
          p.id,
          submission,
        ]),
      "service_role",
    ),
    /missing/,
  );
  await asUser(p.id, (tx) => tx.query("select withdraw_personal_selfie()"));
  await db.query(
    "insert into storage.objects(bucket_id,name)values('avatars',$1),('selfie_proofs',$2)",
    [p.avatar, `${p.id}/selfie-next.jpg`],
  );
  await assert.rejects(
    submitSelfie(p.id, `${p.id}/selfie-next.jpg`),
    /two minutes/,
  );
  await db.query(
    "update personal_selfie_reviews set submitted_at=now()-interval '3 minutes',attempt_day=(now() at time zone 'UTC')::date,attempts_today=5 where user_id=$1",
    [p.id],
  );
  await assert.rejects(
    submitSelfie(p.id, `${p.id}/selfie-next.jpg`),
    /five selfies/,
  );
});

test("selfies: existing app builds can update legacy avatars, which are excluded from new comparisons", async () => {
  const id = await corePersonal(),
    path = `${id}/avatar.jpg`;
  await asUser(id, (tx) =>
    tx.query(
      "insert into storage.objects(bucket_id,name)values('avatars',$1),('selfie_proofs',$2)",
      [path, `${id}/selfie-legacy.jpg`],
    ),
  );
  assert.equal(
    (
      await asUser(id, (tx) =>
        tx.query(
          "update storage.objects set name=name where bucket_id='avatars' and name=$1 returning name",
          [path],
        ),
      )
    ).rows.length,
    1,
  );
  await asUser(id, (tx) =>
    tx.query("update profiles set avatar_url=$2 where id=$1", [
      id,
      `https://project.supabase.co/storage/v1/object/public/avatars/${path}`,
    ]),
  );
  await assert.rejects(
    submitSelfie(id, `${id}/selfie-legacy.jpg`),
    /Upload a clear profile photo/,
  );
});

test("meeting location writes preserve user labels, enforce host ownership and delete expired Google coordinates", async () => {
  const owner = "00000000-0000-0000-0000-000000003110";
  const stranger = "00000000-0000-0000-0000-000000003111";
  for (const id of [owner, stranger]) {
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",
      [
        id,
        `${id}@test.example`,
        JSON.stringify({
          account_type: "personal",
          display_name: "Location tester",
        }),
      ],
    );
    await db.query(
      "update profiles set age=25,gender='male',terms_version='2026-10-19',onboarding_completed=true where id=$1",
      [id],
    );
  }
  const saved = await asUser(
    owner,
    async (tx) =>
      (
        await tx.query(
          `insert into posts(author_id,title,description,starts_at,vacancies,venue_name,location_lat,location_lng,location_source,location_place_id,location_cached_at)
    values($1,'Meet at the courtyard','Friendly coffee in the courtyard',now()+interval '4 hours',2,'My courtyard',10,76,'google','google-place',now()+interval '1 year') returning *`,
          [owner],
        )
      ).rows[0],
  );
  assert.ok(
    Math.abs(Date.parse(saved.location_cached_at) - Date.now()) < 10000,
  );
  const card = await asUser(
    owner,
    async (tx) =>
      (await tx.query("select * from post_cards where id=$1", [saved.id]))
        .rows[0],
  );
  assert.equal(card.location_lat, 10);
  assert.equal(card.venue_id, null);
  assert.equal(card.venue_name, "My courtyard");
  await asUser(stranger, async (tx) =>
    tx.query("update posts set location_lat=11 where id=$1", [saved.id]),
  );
  assert.equal(
    (await db.query("select location_lat from posts where id=$1", [saved.id]))
      .rows[0].location_lat,
    10,
  );
  await assert.rejects(() =>
    asUser(owner, async (tx) =>
      tx.query("update posts set location_lng=181 where id=$1", [saved.id]),
    ),
  );
  await assert.rejects(() =>
    asUser(owner, async (tx) =>
      tx.query("update posts set location_cached_at=now() where id=$1", [
        saved.id,
      ]),
    ),
  );
  // Simulate an old cache in this disposable DB; clients cannot edit its timestamp.
  await db.exec("alter table posts disable trigger guard_post_location");
  await db.query(
    "update posts set location_cached_at=now()-interval '30 days' where id=$1",
    [saved.id],
  );
  await db.exec("alter table posts enable trigger guard_post_location");
  assert.equal(
    (
      await asUser(owner, async (tx) =>
        tx.query("select location_lat from post_cards where id=$1", [saved.id]),
      )
    ).rows[0].location_lat,
    null,
  );
  await db.exec("select maintenance_retention_cleanup()");
  const expired = (
    await db.query(
      "select location_lat,location_lng,location_place_id,venue_name from posts where id=$1",
      [saved.id],
    )
  ).rows[0];
  assert.equal(expired.location_lat, null);
  assert.equal(expired.location_lng, null);
  assert.equal(expired.location_place_id, "google-place");
  assert.equal(expired.venue_name, "My courtyard");
  await asUser(owner, async (tx) =>
    tx.query(
      "update posts set location_source='manual',location_place_id=null,location_lat=0,location_lng=-76 where id=$1",
      [saved.id],
    ),
  );
  assert.equal(
    (await db.query("select location_lat from posts where id=$1", [saved.id]))
      .rows[0].location_lat,
    0,
  );
});

test(
  "PostGIS discovers external meeting spots and legacy venues with radius and RLS",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const owner = "00000000-0000-0000-0000-000000003110",
      stranger = "00000000-0000-0000-0000-000000003111";
    const make = async (lat: number, lng: number) =>
      (
        await asUser(owner, async (tx) =>
          tx.query(
            `insert into posts(author_id,title,description,starts_at,vacancies,venue_name,location_lat,location_lng,location_source)
    values($1,'Coordinate plan','Meet at the coordinate spot',now()+interval '4 hours',2,'Host chosen spot',$2,$3,'manual') returning id`,
            [owner, lat, lng],
          ),
        )
      ).rows[0].id;
    const near = await make(10.007, 76.363),
      far = await make(12.97, 77.64);
    const venue = (
      await db.query(
        "insert into venues(name,category,area,location) values('Legacy location','Café','Kakkanad',st_setsrid(st_makepoint(76.363,10.007),4326)::geography) returning id",
      )
    ).rows[0].id;
    const legacy = (
      await asUser(owner, async (tx) =>
        tx.query(
          "insert into posts(author_id,title,description,starts_at,vacancies,venue_id) values($1,'Legacy venue plan','Meet at a registered venue',now()+interval '4 hours',2,$2) returning id",
          [owner, venue],
        ),
      )
    ).rows[0].id;
    const results = await asUser(stranger, async (tx) =>
      tx.query("select nearby_post_cards(10.007,76.363,5000) card"),
    );
    assert.ok(
      results.rows.some(
        (r: any) => r.card.id === near && r.card.distance_km < 0.01,
      ),
    );
    assert.ok(results.rows.some((r: any) => r.card.id === legacy));
    assert.ok(!results.rows.some((r: any) => r.card.id === far));
    await assert.rejects(() =>
      asUser(stranger, async (tx) =>
        tx.query("select nearby_post_cards(100,76,5000)"),
      ),
    );
    await assert.rejects(() =>
      asUser(
        null,
        async (tx) => tx.query("select nearby_post_cards(10,76,5000)"),
        "anon",
      ),
    );
    await asUser(stranger, async (tx) =>
      tx.query("select set_user_block($1,true)", [owner]),
    );
    assert.ok(
      !(
        await asUser(stranger, async (tx) =>
          tx.query("select nearby_post_cards(10.007,76.363,5000) card"),
        )
      ).rows.some((r: any) => [near, legacy].includes(r.card.id)),
    );
  },
);

test("new posts require a selected venue or confirmed coordinates, while legacy posts remain readable", async () => {
  for (const label of [null, "", "  ", "Typed name only"]) {
    await assert.rejects(
      () =>
        asUser(host, (tx) =>
          tx.query(
            `insert into posts(author_id,title,description,starts_at,vacancies,venue_id,venue_name)
      values($1,'A meeting plan','Friendly meeting with neighbours',now()+interval '4 hours',2,null,$2)`,
            [host, label],
          ),
        ),
      /Select a meeting place/,
    );
  }
  const selected = await asUser(host, (tx) =>
    tx.query(
      `insert into posts(author_id,title,description,starts_at,vacancies,venue_id)
    values($1,'Registered venue','Meet at the selected venue',now()+interval '4 hours',2,'10000000-0000-0000-0000-000000000032') returning id`,
      [host],
    ),
  );
  assert.ok(selected.rows[0].id);
  const manual = await asUser(host, (tx) =>
    tx.query(
      `insert into posts(author_id,title,description,starts_at,vacancies,venue_name,location_lat,location_lng,location_source)
    values($1,'Manual meeting spot','Meet at my confirmed meeting spot',now()+interval '4 hours',2,'Courtyard entrance',10,76,'manual') returning id`,
      [host],
    ),
  );
  assert.ok(manual.rows[0].id);
  assert.equal(
    (
      await db.query(
        "select venue_id,location_lat from posts where id='10000000-0000-0000-0000-000000000028'",
      )
    ).rows[0].venue_id,
    null,
  );
});

test("admin account controls require owner authorization and reasons, protect admins, and audit suspend/restore", async () => {
  const owner = await corePersonal(),
    moderator = await corePersonal(),
    target = await corePersonal();
  await db.query(
    "insert into admin_console_members(user_id,role) values($1,'owner'),($2,'moderator')",
    [owner, moderator],
  );
  const decide = (
    actor: string,
    id: string,
    decision: string,
    note = "Reviewed appeal",
  ) =>
    asUser(
      null,
      (tx) =>
        tx.query("select admin_console_decide($1,'account',$2,$3,$4)", [
          actor,
          id,
          decision,
          note,
        ]),
      "service_role",
    );
  await assert.rejects(
    asUser(owner, (tx) =>
      tx.query(
        "select admin_console_decide($1,'account',$2,'suspend','test')",
        [owner, target],
      ),
    ),
    /permission denied/,
  );
  await assert.rejects(decide(moderator, target, "suspend"), /only owner/);
  await assert.rejects(
    decide(owner, target, "suspend", "  "),
    /reason required/,
  );
  await assert.rejects(
    decide(owner, moderator, "suspend"),
    /Cannot suspend an administrator/,
  );
  await decide(owner, target, "suspend");
  assert.ok(
    (await db.query("select suspended_at from profiles where id=$1", [target]))
      .rows[0].suspended_at,
  );
  await assert.rejects(decide(owner, target, "suspend"), /already suspended/);
  await decide(owner, target, "unsuspend");
  assert.equal(
    (await db.query("select suspended_at from profiles where id=$1", [target]))
      .rows[0].suspended_at,
    null,
  );
  assert.deepEqual(
    (
      await db.query(
        "select action,note from admin_console_audit where target_id=$1 order by created_at",
        [target],
      )
    ).rows,
    [
      { action: "account:suspend", note: "Reviewed appeal" },
      { action: "account:unsuspend", note: "Reviewed appeal" },
    ],
  );
});

test("admin cancellation preserves claimed deletion jobs and only cancels an unstarted owner request", async () => {
  const owner = await corePersonal();
  await db.query(
    "insert into admin_console_members(user_id,role) values($1,'owner')",
    [owner],
  );
  const cancel = (id: string) =>
    asUser(
      null,
      (tx) =>
        tx.query(
          "select admin_console_decide($1,'account',$2,'cancel-deletion','Owner request reviewed')",
          [owner, id],
        ),
      "service_role",
    );
  const target = await corePersonal();
  await db.query("select queue_account_deletion($1)", [target]);
  await cancel(target);
  assert.equal(
    (
      await db.query("select deletion_requested_at from profiles where id=$1", [
        target,
      ])
    ).rows[0].deletion_requested_at,
    null,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from account_deletion_jobs where user_id=$1",
        [target],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select action from admin_console_audit where target_id=$1",
        [target],
      )
    ).rows[0].action,
    "account:cancel-deletion",
  );
  // File removal starts when a worker claims the job, not at prepared_at.
  const claimed = await corePersonal();
  await db.query("select queue_account_deletion($1)", [claimed]);
  await db.query("select * from claim_account_deletions()");
  await assert.rejects(cancel(claimed), /Deletion already in progress/);
  assert.ok(
    (
      await db.query("select deletion_requested_at from profiles where id=$1", [
        claimed,
      ])
    ).rows[0].deletion_requested_at,
  );
  assert.ok(
    (
      await db.query(
        "select lease_id from account_deletion_jobs where user_id=$1",
        [claimed],
      )
    ).rows[0].lease_id,
  );
  for (const assignment of [
    "attempts=1,lease_id=null,prepared_at=null",
    "attempts=0,lease_id=gen_random_uuid(),prepared_at=null",
    "attempts=0,lease_id=null,prepared_at=now()",
  ]) {
    await db.query(
      `update account_deletion_jobs set ${assignment} where user_id=$1`,
      [claimed],
    );
    await assert.rejects(cancel(claimed), /Deletion already in progress/);
  }
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from admin_console_audit where target_id=$1",
        [claimed],
      )
    ).rows[0].n,
    0,
  );
  await db.query("delete from account_deletion_jobs where user_id=$1", [
    claimed,
  ]);
  await assert.rejects(cancel(claimed), /Deletion request unavailable/);
});
