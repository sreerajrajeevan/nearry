/** Manual operator tool. Never imported by the app, migrations, builds or CI. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export const PROJECT = "ggeejgykahzquynwighw";
const OWNER = "cocsreeraj@gmail.com";
export const BUCKETS = [
  "avatars",
  "photos",
  "selfie_proofs",
  "verification_docs",
];
// Children precede parents; legacy tables exist on projects upgraded from schema.sql.
export const CLEAR_TABLES = [
  "push_deliveries",
  "push_jobs",
  "push_tokens",
  "notifications",
  "legacy_messages",
  "legacy_threads",
  "legacy_notifications",
  "conversation_reads",
  "conversation_clears",
  "messages",
  "conversations",
  "content_reports",
  "user_blocks",
  "post_photos",
  "venue_photos",
  "personal_selfie_reviews",
  "verification_review_jobs",
  "join_requests",
  "bookings",
  "offer_slots",
  "offers",
  "posts",
  "venues",
  "account_deletion_jobs",
  "media_cleanup_jobs",
  "removed_content",
  "admin_console_audit",
];
const KEEP_TABLES = [
  "profiles",
  "admin_console_members",
  "place_search_usage",
  "spatial_ref_sys",
];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const quote = (s) => `'${s.replaceAll("'", "''")}'`;

export function validatePlan(plan) {
  if (plan.project !== PROJECT || !plan.ownerPresent)
    throw new Error(
      "Wrong project or the protected owner is missing/inactive.",
    );
  if (!plan.adminIds.length || plan.adminIds.some((id) => !uuid.test(id)))
    throw new Error("An existing administrator must be preserved.");
  if (
    plan.userIds.some((id) => !uuid.test(id)) ||
    plan.adminIds.some((id) => !plan.userIds.includes(id))
  )
    throw new Error("Invalid account inventory.");
  if (plan.tables.some((t) => ![...CLEAR_TABLES, ...KEEP_TABLES].includes(t)))
    throw new Error("Unknown public table: review the reset scope first.");
  if (
    plan.files.some(
      (f) =>
        !BUCKETS.includes(f.bucket) || typeof f.path !== "string" || !f.path,
    )
  )
    throw new Error(
      "An uploaded file is outside the reviewed storage buckets.",
    );
  if (plan.userIds.length > 1000 || plan.files.length > 10000)
    throw new Error(
      "This testing-only reset is too large; review it manually.",
    );
  return plan;
}

export function fingerprint(plan) {
  validatePlan(plan);
  return createHash("sha256").update(JSON.stringify(plan)).digest("hex");
}

export function clearDataSql(plan) {
  validatePlan(plan);
  const admins = plan.adminIds.map(quote).join(",");
  const users = plan.userIds.map(quote).join(",");
  const tables = CLEAR_TABLES.filter((t) => plan.tables.includes(t));
  return `begin;
set local lock_timeout = '5s';
lock table ${[...tables, "profiles", "admin_console_members"].map((t) => `public.${t}`).join(",")} in access exclusive mode;
do $reset$
begin
 if (select array_agg(id::text order by id::text) from auth.users) is distinct from array[${users}]::text[] then
  raise exception 'Accounts changed: stop and review a new plan';
 end if;
 if (select array_agg(user_id::text order by user_id::text) from public.admin_console_members) is distinct from array[${admins}]::text[] then
  raise exception 'Administrator list changed';
 end if;
 if not exists(select 1 from auth.users u join public.admin_console_members a on a.user_id=u.id
   join public.profiles p on p.id=u.id where lower(u.email)=${quote(OWNER)} and a.role='owner'
   and a.revoked_at is null and p.suspended_at is null and p.deletion_requested_at is null) then
  raise exception 'Protected owner unavailable';
 end if;
 if exists(select 1 from storage.objects) then raise exception 'Remove uploaded files through Storage API first'; end if;
end $reset$;
-- Avatar changes can queue media cleanup; clear links before emptying the queues.
-- All uploads have already been removed through the Storage API.
update public.profiles set avatar_url=null,verification_doc_path=null where id in (${admins});
${tables.map((t) => `delete from public.${t};`).join("\n")}
-- Retain global paid-provider quotas, while removing per-account counters.
delete from public.place_search_usage where scope not in ('global_day','global_second');
select true as app_data_cleared;
commit;`;
}

/** Ordered side effects: exact approval, files first, data transaction, Auth last. */
export async function executeReset(plan, confirmation, actions) {
  if (confirmation !== fingerprint(plan))
    throw new Error("Exact reset confirmation required.");
  if (fingerprint(await actions.inventory()) !== confirmation)
    throw new Error("Data changed after review. Run the preview again.");
  for (const bucket of BUCKETS) {
    const paths = plan.files
      .filter((f) => f.bucket === bucket)
      .map((f) => f.path);
    for (let i = 0; i < paths.length; i += 100)
      await actions.removeFiles(bucket, paths.slice(i, i + 100));
  }
  const remaining = await actions.inventory();
  if (remaining.files.length)
    throw new Error(
      "Files remain; no database reset or Auth deletion was attempted.",
    );
  if (
    JSON.stringify(remaining.userIds) !== JSON.stringify(plan.userIds) ||
    JSON.stringify(remaining.adminIds) !== JSON.stringify(plan.adminIds)
  )
    throw new Error(
      "Account inventory changed during file removal. Review again.",
    );
  await actions.clearData(clearDataSql(plan));
  for (const id of plan.userIds)
    if (!plan.adminIds.includes(id)) await actions.deleteUser(id);
  const after = await actions.inventory();
  if (
    JSON.stringify(after.userIds) !== JSON.stringify(plan.adminIds) ||
    JSON.stringify(after.adminIds) !== JSON.stringify(plan.adminIds) ||
    after.files.length ||
    Object.values(after.counts).some((count) => count !== 0)
  )
    throw new Error(
      "Reset verification incomplete. Inspect the new preview before retrying.",
    );
  return summary(after);
}

export function summary(plan) {
  validatePlan(plan);
  return {
    project: plan.project,
    accountsToDelete: plan.userIds.length - plan.adminIds.length,
    administratorAccountsKept: plan.adminIds.length,
    uploadedFilesToRemove: plan.files.length,
    rowsToClear: plan.counts,
    confirmation: fingerprint(plan),
  };
}

function cli(args) {
  try {
    return JSON.parse(
      execFileSync("supabase", [...args, "--output", "json"], {
        encoding: "utf8",
        timeout: 60000,
        maxBuffer: 8 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
  } catch {
    // Never echo CLI key payloads, SQL account identifiers, or subprocess stderr.
    throw new Error(
      "Supabase operator command failed. Check CLI login and project access.",
    );
  }
}
function query(sql) {
  const result = cli([
    "db",
    "query",
    "--linked",
    "--project-ref",
    PROJECT,
    sql,
  ]);
  if (!Array.isArray(result.rows))
    throw new Error("Unrecognized SQL response.");
  return result.rows;
}

async function inventory() {
  const schema = query(
    `begin read only; select coalesce(jsonb_agg(table_name order by table_name),'[]') as tables from information_schema.tables where table_schema='public' and table_type='BASE TABLE'; commit;`,
  )[0].tables;
  const known = [...CLEAR_TABLES, ...KEEP_TABLES];
  if (schema.some((t) => !known.includes(t)))
    throw new Error(
      "Unknown public table. Review the schema before resetting.",
    );
  const tables = CLEAR_TABLES.filter((t) => schema.includes(t));
  const counts = tables
    .flatMap((t) => [quote(t), `(select count(*) from public.${t})`])
    .join(",");
  const plan = query(`begin read only; select jsonb_build_object(
   'project',${quote(PROJECT)},'tables',${quote(JSON.stringify(schema))}::jsonb,
   'ownerPresent',exists(select 1 from auth.users u join public.admin_console_members a on a.user_id=u.id join public.profiles p on p.id=u.id where lower(u.email)=${quote(OWNER)} and a.role='owner' and a.revoked_at is null and p.suspended_at is null and p.deletion_requested_at is null),
   'userIds',(select coalesce(jsonb_agg(id::text order by id::text),'[]') from auth.users),
   'adminIds',(select coalesce(jsonb_agg(user_id::text order by user_id::text),'[]') from public.admin_console_members),
   'files',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'bucket',bucket_id,'path',name,'updatedAt',updated_at) order by bucket_id,name),'[]') from storage.objects),
   'counts',jsonb_build_object(${counts})) as plan; commit;`)[0].plan;
  return validatePlan(plan);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length && !(args.length === 2 && args[0] === "--execute"))
    throw new Error(
      "Usage: node scripts/reset-test-data.mjs [--execute REVIEWED_FINGERPRINT]",
    );
  const plan = await inventory();
  if (!args.length) {
    console.log(JSON.stringify(summary(plan), null, 2));
    console.log("PREVIEW ONLY. No data has been changed.");
    return;
  }
  // Validate before accessing any server key; do not persist credentials.
  if (args[1] !== fingerprint(plan))
    throw new Error("Confirmation is missing or stale. Preview again.");
  const keys = cli([
    "projects",
    "api-keys",
    "--project-ref",
    PROJECT,
    "--reveal",
  ]);
  const key = (Array.isArray(keys) ? keys : keys.rows)?.find(
    (k) => k.name === "service_role",
  )?.api_key;
  if (!key) throw new Error("Server-side operator key unavailable.");
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(`https://${PROJECT}.supabase.co`, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = await executeReset(plan, args[1], {
    inventory,
    removeFiles: async (bucket, paths) => {
      const { error } = await client.storage.from(bucket).remove(paths);
      if (error)
        throw new Error(
          "Storage removal failed. Database/Auth deletion stopped.",
        );
    },
    clearData: async (sql) => query(sql),
    deleteUser: async (id) => {
      const { error } = await client.auth.admin.deleteUser(id);
      if (error)
        throw new Error(
          "An account could not be deleted. Review the current preview before retrying.",
        );
    },
  });
  console.log(JSON.stringify({ verified: true, ...result }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
