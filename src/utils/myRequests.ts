import type { JoinRequest } from "../services/mappers";

export type MyPlanStatus = "pending" | "approved";

/**
 * My current status per plan, from my requests newest first. Only a pending
 * or approved latest request counts; after a decline or withdrawal the card
 * offers Join again.
 */
export function myRequestStatuses(
  requests: Pick<JoinRequest, "postId" | "status">[],
): Map<string, MyPlanStatus> {
  const latest = new Map<string, JoinRequest["status"]>();
  for (const r of requests)
    if (!latest.has(r.postId)) latest.set(r.postId, r.status);
  const result = new Map<string, MyPlanStatus>();
  for (const [postId, status] of latest)
    if (status === "pending" || status === "approved")
      result.set(postId, status);
  return result;
}
