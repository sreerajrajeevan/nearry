import test from "node:test";
import assert from "node:assert/strict";
import {
  executeReset,
  fingerprint,
  clearDataSql,
  validatePlan,
  PROJECT,
  CLEAR_TABLES,
} from "../scripts/reset-test-data.mjs";

const admin = "00000000-0000-0000-0000-000000000001";
const user = "00000000-0000-0000-0000-000000000002";
const fixture = () => ({
  project: PROJECT,
  ownerPresent: true,
  tables: [
    ...CLEAR_TABLES,
    "profiles",
    "admin_console_members",
    "place_search_usage",
    "spatial_ref_sys",
  ].sort(),
  userIds: [admin, user],
  adminIds: [admin],
  files: [
    {
      id: "file",
      bucket: "photos",
      path: `${user}/post.jpg`,
      updatedAt: "2026-11-13",
    },
  ],
  counts: Object.fromEntries(
    CLEAR_TABLES.map((t) => [t, t === "posts" ? 1 : 0]),
  ),
});
function actions(plan = fixture()) {
  let state = structuredClone(plan);
  const calls: string[] = [];
  return {
    calls,
    inventory: async () => structuredClone(state),
    removeFiles: async () => {
      calls.push("storage");
      state.files = [];
    },
    clearData: async () => {
      calls.push("database");
      state.counts = Object.fromEntries(CLEAR_TABLES.map((t) => [t, 0]));
    },
    deleteUser: async (id: string) => {
      calls.push(`auth:${id}`);
      state.userIds = state.userIds.filter((u) => u !== id);
    },
  };
}

test("test reset requires the exact project, an active owner and a known schema before any side effects", async () => {
  for (const invalid of [
    { ...fixture(), project: "another-project" },
    { ...fixture(), ownerPresent: false },
    { ...fixture(), adminIds: [] },
    { ...fixture(), tables: [...fixture().tables, "unreviewed_table"] },
    {
      ...fixture(),
      files: [{ ...fixture().files[0], bucket: "unreviewed_bucket" }],
    },
  ])
    assert.throws(() => validatePlan(invalid));
  const work = actions();
  await assert.rejects(
    executeReset(fixture(), "not-confirmed", work),
    /confirmation/,
  );
  assert.deepEqual(work.calls, []);
});

test("test reset rejects a changed account/file inventory without deleting anything", async () => {
  const plan = fixture();
  for (const changed of [
    {
      ...plan,
      userIds: [...plan.userIds, "00000000-0000-0000-0000-000000000003"],
    },
    { ...plan, files: [{ ...plan.files[0], updatedAt: "later-upload" }] },
  ]) {
    const work = actions(changed);
    await assert.rejects(
      executeReset(plan, fingerprint(plan), work),
      /changed/,
    );
    assert.deepEqual(work.calls, []);
  }
});

test("test reset stops before SQL/Auth when storage removal fails or files remain", async () => {
  const plan = fixture();
  const failed = actions();
  failed.removeFiles = async () => {
    throw new Error("storage unavailable");
  };
  await assert.rejects(
    executeReset(plan, fingerprint(plan), failed),
    /storage unavailable/,
  );
  assert.deepEqual(failed.calls, []);
  const remains = actions();
  remains.removeFiles = async () => {
    remains.calls.push("storage");
  };
  await assert.rejects(
    executeReset(plan, fingerprint(plan), remains),
    /Files remain/,
  );
  assert.deepEqual(remains.calls, ["storage"]);
});

test("test reset never deletes Auth after a failed data transaction", async () => {
  const plan = fixture();
  const work = actions();
  work.clearData = async () => {
    throw new Error("transaction failed");
  };
  await assert.rejects(
    executeReset(plan, fingerprint(plan), work),
    /transaction failed/,
  );
  assert.deepEqual(work.calls, ["storage"]);
});

test("test reset removes files before data/accounts and preserves the admin identity", async () => {
  const plan = fixture();
  const work = actions();
  const after = await executeReset(plan, fingerprint(plan), work);
  assert.deepEqual(work.calls, ["storage", "database", `auth:${user}`]);
  assert.equal(after.accountsToDelete, 0);
  assert.equal(after.administratorAccountsKept, 1);
  const sql = clearDataSql(plan);
  assert.match(sql, /lock table/);
  assert.match(sql, /Accounts changed/);
  assert.match(sql, /Remove uploaded files through Storage API first/);
  assert.match(sql, /scope not in \('global_day','global_second'\)/);
  assert.doesNotMatch(
    sql,
    /truncate|drop table|delete from auth\.users|delete from public\.profiles|delete from storage\.objects|delete from public\.admin_console_members/i,
  );
});

test("test reset reports a partial Auth failure and a nonempty final result", async () => {
  const plan = fixture();
  const failed = actions();
  failed.deleteUser = async () => {
    throw new Error("Auth unavailable");
  };
  await assert.rejects(
    executeReset(plan, fingerprint(plan), failed),
    /Auth unavailable/,
  );
  assert.deepEqual(failed.calls, ["storage", "database"]);
  const remains = actions();
  remains.deleteUser = async () => {};
  await assert.rejects(
    executeReset(plan, fingerprint(plan), remains),
    /verification incomplete/,
  );
});
