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
  await db.query("update profiles set onboarding_completed=true where id=$1", [
    id,
  ]);
  return id;
}

test("core journey: create, request, approve, chat, read and cancel preserve permissions and notify participants", async () => {
  const owner = await corePersonal(),
    participant = await corePersonal(),
    waiting = await corePersonal();
  const p = (
    await asUser(owner, (tx) =>
      tx.query(
        "insert into posts(author_id,title,description,starts_at,vacancies) values($1,'Chaya and a walk','A friendly evening by the waterfront',now()+interval '4 hours',2) returning id",
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
      "insert into posts(author_id,title,description,starts_at,vacancies) values($1,'Read cursor test','A friendly read cursor regression',now()+interval '4 hours',2) returning id",
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
          "insert into posts(author_id,title,description,starts_at,vacancies) values($1,'Empty plan','A friendly plan without any requests',now()+interval '4 hours',2) returning id",
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
