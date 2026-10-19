type Database = any;
const check = (result: any) => {
  if (result.error)
    throw new Error(result.error.message ?? "database operation failed");
  return result.data;
};
export async function processAccountDeletions(db: Database) {
  const jobs = check(await db.rpc("claim_account_deletions")) ?? [];
  let deleted = 0,
    failed = 0;
  check(await db.rpc("maintenance_retention_cleanup"));
  const cleanup = check(await db.rpc("claim_media_cleanup")) ?? [];
  for (const file of cleanup) {
    try {
      check(await db.storage.from(file.bucket).remove([file.path]));
      check(await db.from("media_cleanup_jobs").delete().eq("id", file.id));
    } catch (e) {
      failed++;
      await db
        .from("media_cleanup_jobs")
        .update({
          last_error:
            e instanceof Error
              ? e.message.slice(0, 200)
              : "Media cleanup failed",
        })
        .eq("id", file.id);
    }
  }

  for (const job of jobs) {
    try {
      let empty = false;
      // Bounded work; large accounts resume safely in the next leased run.
      for (let page = 0; page < 20; page++) {
        const files =
          check(
            await db.rpc("deletion_storage_batch", { p_user: job.user_id }),
          ) ?? [];
        if (!files.length) {
          empty = true;
          break;
        }
        const buckets = new Map<string, string[]>();
        for (const file of files) {
          const paths = buckets.get(file.bucket) ?? [];
          paths.push(file.path);
          buckets.set(file.bucket, paths);
        }
        for (const [bucket, paths] of buckets)
          check(await db.storage.from(bucket).remove(paths));
      }
      if (!empty) throw new Error("More files remain; continue next run");
      // A successful earlier Auth deletion may have lost its acknowledgement.
      const lookup = await db.auth.admin.getUserById(job.user_id);
      if (lookup.error && lookup.error.status !== 404)
        throw new Error(lookup.error.message);
      if (lookup.data?.user) {
        check(await db.rpc("prepare_auth_deletion", { p_user: job.user_id }));
        check(await db.auth.admin.deleteUser(job.user_id));
      }
      check(
        await db
          .from("account_deletion_jobs")
          .delete()
          .eq("user_id", job.user_id)
          .eq("lease_id", job.lease_id),
      );
      deleted++;
    } catch (e) {
      failed++;
      await db
        .from("account_deletion_jobs")
        .update({
          last_error:
            e instanceof Error ? e.message.slice(0, 200) : "Deletion failed",
        })
        .eq("user_id", job.user_id)
        .eq("lease_id", job.lease_id);
    }
  }
  return { deleted, failed };
}
export function createAccountMaintenanceHandler(
  db: Database,
  secret: string | undefined,
) {
  return async (req: Request) => {
    if (!secret || req.headers.get("x-dispatch-secret") !== secret)
      return new Response("unauthorized", { status: 401 });
    if (req.method !== "POST")
      return new Response("method not allowed", { status: 405 });
    try {
      return Response.json(await processAccountDeletions(db));
    } catch {
      return new Response("Account maintenance failed", { status: 500 });
    }
  };
}
