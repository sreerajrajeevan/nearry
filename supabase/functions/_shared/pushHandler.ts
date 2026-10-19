type Database = any;
const check = (result: any) => {
  if (result.error)
    throw new Error(result.error.message ?? "Database operation failed");
  return result.data;
};
async function expo(
  path: string,
  body: unknown,
  send: typeof fetch,
  token?: string,
) {
  const response = await send(`https://exp.host/--/api/v2/push/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Expo HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error("Expo rejected the request");
  return payload.data;
}
async function removeStaleToken(
  db: Database,
  token: string,
  registeredAt: string,
) {
  check(
    await db
      .from("push_tokens")
      .delete()
      .eq("token", token)
      .lte("updated_at", registeredAt),
  );
}
export async function processPush(
  db: Database,
  send: typeof fetch = fetch,
  accessToken?: string,
) {
  let sent = 0,
    failed = 0,
    receipts = 0;
  const due = check(await db.rpc("claim_push_receipts")) ?? [];
  if (due.length) {
    try {
      const statuses = await expo(
        "getReceipts",
        { ids: due.map((r: any) => r.ticket_id) },
        send,
        accessToken,
      );
      if (!statuses || typeof statuses !== "object" || Array.isArray(statuses))
        throw new Error("Invalid receipt response");
      for (const delivery of due) {
        const receipt = statuses[delivery.ticket_id];
        if (!receipt) {
          if (
            Date.now() - new Date(delivery.created_at).getTime() >
            24 * 3600000
          )
            check(
              await db
                .from("push_deliveries")
                .update({
                  status: "failed",
                  last_error: "Receipt unavailable after 24 hours",
                  checked_at: new Date().toISOString(),
                })
                .eq("id", delivery.id),
            );
          continue;
        }
        const reason = receipt.details?.error;
        if (receipt.status === "error" && reason === "DeviceNotRegistered")
          await removeStaleToken(db, delivery.token, delivery.registered_at);
        check(
          await db
            .from("push_deliveries")
            .update({
              status:
                receipt.status === "ok"
                  ? "delivered"
                  : reason === "DeviceNotRegistered"
                    ? "dead"
                    : "failed",
              last_error:
                receipt.status === "ok"
                  ? null
                  : String(reason ?? "Push receipt error").slice(0, 200),
              checked_at: new Date().toISOString(),
            })
            .eq("id", delivery.id),
        );
        receipts++;
      }
    } catch {
      failed++; /* claims retain a bounded next-check time for retry */
    }
  }
  const jobs = check(await db.rpc("claim_push_jobs")) ?? [];
  for (const job of jobs) {
    try {
      // Recheck current settings: a token may have moved accounts after the claim.
      const allowed = check(
        await db.rpc("notification_allowed", {
          p_user: job.user_id,
          p_kind: job.kind,
          p_ref: job.ref_id,
        }),
      );
      const pref = check(
        await db
          .from("profiles")
          .select("push_enabled")
          .eq("id", job.user_id)
          .maybeSingle(),
      );
      if (allowed && pref?.push_enabled) {
        const tokens =
          check(
            await db
              .from("push_tokens")
              .select("token,updated_at")
              .eq("user_id", job.user_id),
          ) ?? [];
        const recorded =
          check(
            await db
              .from("push_deliveries")
              .select("token,status")
              .eq("job_id", job.id),
          ) ?? [];
        const accepted = new Set(
          recorded
            .filter((r: any) =>
              ["ticket", "delivered", "dead"].includes(r.status),
            )
            .map((r: any) => r.token),
        );
        const pending = tokens.filter((t: any) => !accepted.has(t.token));
        for (let start = 0; start < pending.length; start += 100) {
          const batch = pending.slice(start, start + 100);
          // Notification text remains inside the authenticated app; no private chat
          // body is included on a phone lock screen or sent to push intermediaries.
          const tickets = await expo(
            "send",
            batch.map((t: any) => ({
              to: t.token,
              title: "Nearry",
              body:
                job.kind === "message"
                  ? "You have a new message."
                  : "You have an update in Nearry.",
              sound: "default",
              channelId: "default",
              data: { notificationId: job.notification_id },
            })),
            send,
            accessToken,
          );
          if (!Array.isArray(tickets) || tickets.length !== batch.length)
            throw new Error("Invalid Expo response");
          let rejected = false;
          for (let i = 0; i < tickets.length; i++) {
            const ticket = tickets[i],
              t = batch[i];
            if (ticket.status === "ok" && typeof ticket.id === "string") {
              check(
                await db
                  .from("push_deliveries")
                  .upsert(
                    {
                      job_id: job.id,
                      token: t.token,
                      registered_at: t.updated_at,
                      ticket_id: ticket.id,
                      status: "ticket",
                      last_error: null,
                    },
                    { onConflict: "job_id,token" },
                  ),
              );
            } else if (ticket.details?.error === "DeviceNotRegistered") {
              await removeStaleToken(db, t.token, t.updated_at);
              check(
                await db
                  .from("push_deliveries")
                  .upsert(
                    {
                      job_id: job.id,
                      token: t.token,
                      registered_at: t.updated_at,
                      status: "dead",
                      last_error: "DeviceNotRegistered",
                    },
                    { onConflict: "job_id,token" },
                  ),
              );
            } else rejected = true;
          }
          if (rejected)
            throw new Error(
              "Some push deliveries were rejected; accepted devices are retained",
            );
        }
      }
      check(
        await db
          .from("push_jobs")
          .update({ sent_at: new Date().toISOString(), last_error: null })
          .eq("id", job.id),
      );
      sent++;
    } catch (e) {
      failed++;
      await db
        .from("push_jobs")
        .update({
          last_error:
            e instanceof Error
              ? e.message.slice(0, 200)
              : "Push delivery failed",
        })
        .eq("id", job.id);
    }
  }
  return { sent, failed, receipts };
}
export function createPushHandler(
  db: Database,
  secret: string | undefined,
  send: typeof fetch = fetch,
  accessToken?: string,
) {
  return async (req: Request) => {
    if (!secret || req.headers.get("x-dispatch-secret") !== secret)
      return new Response("unauthorized", { status: 401 });
    if (req.method !== "POST")
      return new Response("method not allowed", { status: 405 });
    try {
      return Response.json(await processPush(db, send, accessToken));
    } catch {
      return new Response("Could not process push delivery", { status: 500 });
    }
  };
}
