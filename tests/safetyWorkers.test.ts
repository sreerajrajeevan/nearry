import test from "node:test";
import assert from "node:assert/strict";
import {
  createAccountMaintenanceHandler,
  processAccountDeletions,
} from "../supabase/functions/_shared/accountMaintenance";
import {
  createPushHandler,
  processPush,
} from "../supabase/functions/_shared/pushHandler";

type Row = Record<string, any>;
function fakeDb() {
  const tables: Record<string, Row[]> = {
    account_deletion_jobs: [],
    media_cleanup_jobs: [],
    profiles: [],
    push_tokens: [],
    push_jobs: [],
    push_deliveries: [],
  };
  const log: string[] = [];
  let files: Row[] = [];
  let storageFailure = false;
  let authExists = true;
  const db: any = {
    from(table: string) {
      const filters: ((r: Row) => boolean)[] = [];
      let operation = "select",
        payload: any;
      let single = false;
      const query: any = {
        select: () => query,
        eq: (key: string, value: any) => {
          filters.push((r) => r[key] === value);
          return query;
        },
        lte: (key: string, value: any) => {
          filters.push((r) => r[key] <= value);
          return query;
        },
        maybeSingle: () => {
          single = true;
          return query;
        },
        update: (data: any) => {
          operation = "update";
          payload = data;
          return query;
        },
        delete: () => {
          operation = "delete";
          return query;
        },
        upsert: (data: any) => {
          operation = "upsert";
          payload = data;
          return query;
        },
        then(resolve: any, reject: any) {
          try {
            tables[table] ??= [];
            let rows = tables[table].filter((r) => filters.every((f) => f(r)));
            if (operation === "update") {
              for (const r of rows) Object.assign(r, payload);
            }
            if (operation === "delete") {
              tables[table] = tables[table].filter((r) => !rows.includes(r));
              log.push(`delete:${table}`);
            }
            if (operation === "upsert") {
              const existing = tables[table].find(
                (r) => r.job_id === payload.job_id && r.token === payload.token,
              );
              if (existing) Object.assign(existing, payload);
              else
                tables[table].push({
                  id: `delivery-${tables[table].length}`,
                  created_at: new Date().toISOString(),
                  next_check_at: new Date(Date.now() + 900000).toISOString(),
                  ...payload,
                });
            }
            return Promise.resolve({
              data: single ? (rows[0] ?? null) : structuredClone(rows),
              error: null,
            }).then(resolve, reject);
          } catch (e) {
            return Promise.reject(e).then(resolve, reject);
          }
        },
      };
      return query;
    },
    async rpc(name: string) {
      log.push(name);
      if (name === "claim_account_deletions")
        return { data: tables.account_deletion_jobs, error: null };
      if (name === "claim_media_cleanup")
        return { data: tables.media_cleanup_jobs, error: null };
      if (name === "deletion_storage_batch")
        return { data: structuredClone(files), error: null };
      if (name === "prepare_auth_deletion") {
        assert.equal(files.length, 0);
        return { data: null, error: null };
      }
      if (name === "claim_push_receipts")
        return {
          data: tables.push_deliveries.filter(
            (r) =>
              r.status === "ticket" &&
              new Date(r.next_check_at).getTime() <= Date.now(),
          ),
          error: null,
        };
      if (name === "claim_push_jobs")
        return {
          data: tables.push_jobs.filter((r) => !r.sent_at),
          error: null,
        };
      if (name === "notification_allowed") return { data: true, error: null };
      return { data: null, error: null };
    },
    storage: {
      from: () => ({
        async remove(paths: string[]) {
          log.push("remove:files");
          if (storageFailure)
            return { error: { message: "Storage unavailable" } };
          files = files.filter((f) => !paths.includes(f.path));
          return { data: [], error: null };
        },
      }),
    },
    auth: {
      admin: {
        async getUserById() {
          log.push("lookup:auth");
          return authExists
            ? { data: { user: { id: "owner" } }, error: null }
            : {
                data: { user: null },
                error: { status: 404, message: "Not found" },
              };
        },
        async deleteUser() {
          log.push("delete:auth");
          authExists = false;
          return { data: {}, error: null };
        },
      },
    },
  };
  return {
    db,
    tables,
    log,
    setFiles: (value: Row[]) => {
      files = value;
    },
    failStorage: () => {
      storageFailure = true;
    },
  };
}

test("maintenance and push endpoints reject unauthorised callers before database work", async () => {
  for (const create of [createAccountMaintenanceHandler, createPushHandler]) {
    const f = fakeDb();
    const handler = create(f.db, "server-only");
    assert.equal(
      (await handler(new Request("https://worker.test", { method: "POST" })))
        .status,
      401,
    );
    assert.equal(
      (
        await handler(
          new Request("https://worker.test", {
            headers: { "x-dispatch-secret": "server-only" },
          }),
        )
      ).status,
      405,
    );
    assert.deepEqual(f.log, []);
  }
});
test("account deletion removes files before deleting Auth and clears the completed job", async () => {
  const f = fakeDb();
  f.tables.account_deletion_jobs.push({ user_id: "owner", lease_id: "lease" });
  f.setFiles([
    { bucket: "photos", path: "owner/posts/photo.png" },
    { bucket: "verification_docs", path: "owner/proof.png" },
  ]);
  const result = await processAccountDeletions(f.db);
  assert.equal(result.deleted, 1);
  assert.equal(result.failed, 0);
  assert.ok(
    f.log.indexOf("remove:files") < f.log.indexOf("prepare_auth_deletion"),
  );
  assert.ok(
    f.log.indexOf("prepare_auth_deletion") < f.log.indexOf("delete:auth"),
  );
  assert.equal(f.tables.account_deletion_jobs.length, 0);
});
test("storage failure never deletes Auth and retains a retryable deletion job", async () => {
  const f = fakeDb();
  f.tables.account_deletion_jobs.push({ user_id: "owner", lease_id: "lease" });
  f.setFiles([{ bucket: "photos", path: "owner/file.png" }]);
  f.failStorage();
  const result = await processAccountDeletions(f.db);
  assert.equal(result.failed, 1);
  assert.ok(!f.log.includes("delete:auth"));
  assert.ok(!f.log.includes("prepare_auth_deletion"));
  assert.equal(
    f.tables.account_deletion_jobs[0].last_error,
    "Storage unavailable",
  );
});
test("push retries skip devices with accepted tickets and never send private message text", async () => {
  const f = fakeDb();
  f.tables.profiles.push({ id: "person", push_enabled: true });
  f.tables.push_tokens.push(
    { user_id: "person", token: "token-one", updated_at: "2026-10-19" },
    { user_id: "person", token: "token-two", updated_at: "2026-10-19" },
  );
  f.tables.push_jobs.push({
    id: "job",
    notification_id: "notice",
    user_id: "person",
    kind: "message",
    ref_id: "conversation",
    body: "PRIVATE CHAT CONTENT",
  });
  const batches: any[] = [];
  let first = true;
  const send = (async (_url: any, init: any) => {
    const batch = JSON.parse(init.body);
    batches.push(batch);
    return Response.json({
      data: batch.map((message: any) =>
        message.to === "token-two" && first
          ? { status: "error", details: { error: "MessageRateExceeded" } }
          : { status: "ok", id: `ticket-${message.to}` },
      ),
    });
  }) as typeof fetch;
  assert.equal((await processPush(f.db, send)).failed, 1);
  first = false;
  assert.equal((await processPush(f.db, send)).sent, 1);
  assert.deepEqual(
    batches[0].map((m: any) => m.to),
    ["token-one", "token-two"],
  );
  assert.deepEqual(
    batches[1].map((m: any) => m.to),
    ["token-two"],
  );
  assert.equal(JSON.stringify(batches).includes("PRIVATE CHAT CONTENT"), false);
  assert.deepEqual(batches[0][0].data, { notificationId: "notice" });
});
test("receipt rejection removes only stale registrations, preserving a reassigned token", async () => {
  const f = fakeDb();
  f.tables.push_tokens.push(
    { token: "old-device", updated_at: "2026-10-18" },
    { token: "reassigned-device", updated_at: "2026-10-20" },
  );
  f.tables.push_deliveries.push(
    ...["old-device", "reassigned-device"].map((token, i) => ({
      id: `d${i}`,
      token,
      registered_at: "2026-10-19",
      ticket_id: `t${i}`,
      status: "ticket",
      next_check_at: "2026-10-18",
      created_at: new Date().toISOString(),
    })),
  );
  const send = (async () =>
    Response.json({
      data: {
        t0: { status: "error", details: { error: "DeviceNotRegistered" } },
        t1: { status: "error", details: { error: "DeviceNotRegistered" } },
      },
    })) as typeof fetch;
  assert.equal((await processPush(f.db, send)).receipts, 2);
  assert.deepEqual(
    f.tables.push_tokens.map((r) => r.token),
    ["reassigned-device"],
  );
  assert.ok(f.tables.push_deliveries.every((r) => r.status === "dead"));
});
