import { getSupabase, isDemoMode } from "./supabase";
import { notifyUnreadChanged } from "./unreadEvents";
import { mockConversations } from "../data/mock";

export type ReportKind =
  "post" | "photo" | "offer" | "venue" | "user" | "message";
export type ReportTarget = {
  kind: ReportKind;
  id: string;
  userId?: string;
  name?: string;
};
export const REPORT_REASONS = [
  { id: "spam", label: "Spam or advertising" },
  { id: "harassment", label: "Harassment or bullying" },
  { id: "inappropriate", label: "Inappropriate content" },
  { id: "scam", label: "Scam or misleading information" },
  { id: "safety", label: "Safety concern" },
  { id: "other", label: "Something else" },
] as const;
export type BlockedUser = { id: string; name: string; created_at: string };
export type MyReport = {
  id: string;
  target_kind: string;
  reason: string;
  status: string;
  created_at: string;
};
const demoBlocks = new Map<string, BlockedUser>();
const demoReports: MyReport[] = [];
let demoPush = false;
export const demoUserBlocked = (id?: string) => !!id && demoBlocks.has(id);
async function rpc(name: string, params?: Record<string, unknown>) {
  const db = getSupabase();
  if (!db) throw new Error("Sign in to use this feature.");
  const { data, error } = await db.rpc(name, params);
  if (error) throw new Error(error.message);
  return data;
}
export async function reportContent(
  target: ReportTarget,
  reason: string,
  details: string,
): Promise<string> {
  if (!REPORT_REASONS.some((r) => r.id === reason) || details.length > 1000)
    throw new Error("Choose a reason and keep details under 1,000 characters.");
  if (isDemoMode()) {
    const id = `demo-report-${Date.now()}`;
    demoReports.unshift({
      id,
      target_kind: target.kind,
      reason,
      status: "open",
      created_at: new Date().toISOString(),
    });
    return id;
  }
  return rpc("submit_content_report", {
    p_kind: target.kind,
    p_target: target.id,
    p_reason: reason,
    p_details: details.trim(),
  });
}
export async function blockUser(
  id: string,
  blocked: boolean,
  name = "Neighbour",
): Promise<void> {
  if (isDemoMode()) {
    if (blocked)
      demoBlocks.set(id, { id, name, created_at: new Date().toISOString() });
    else demoBlocks.delete(id);
  } else await rpc("set_user_block", { p_user: id, p_blocked: blocked });
  notifyUnreadChanged();
}
export async function listBlockedUsers(): Promise<BlockedUser[]> {
  return isDemoMode()
    ? [...demoBlocks.values()]
    : ((await rpc("list_blocked_users")) ?? []);
}
export async function listMyReports(): Promise<MyReport[]> {
  if (isDemoMode()) return [...demoReports];
  const { data, error } = await getSupabase()!
    .from("content_reports")
    .select("id,target_kind,reason,status,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}
export type ConversationSafety = {
  userId: string;
  name: string;
  canMessage: boolean;
  blockedByMe: boolean;
};
export async function conversationSafety(
  id: string,
): Promise<ConversationSafety | null> {
  if (isDemoMode()) {
    const c = mockConversations.find((item) => item.id === id);
    return c
      ? {
          userId: c.otherUserId,
          name: c.otherName,
          canMessage: !demoUserBlocked(c.otherUserId),
          blockedByMe: demoUserBlocked(c.otherUserId),
        }
      : null;
  }
  return rpc("conversation_safety", { p_conversation: id });
}
export async function notificationPreferences(): Promise<{
  pushEnabled: boolean;
}> {
  return isDemoMode()
    ? { pushEnabled: demoPush }
    : ((await rpc("get_notification_preferences")) ?? { pushEnabled: false });
}
export async function setPushEnabled(enabled: boolean): Promise<void> {
  if (isDemoMode()) demoPush = enabled;
  else await rpc("set_push_enabled", { p_enabled: enabled });
}
export async function requestAccountDeletion(
  confirmation: string,
): Promise<void> {
  if (isDemoMode()) throw new Error("The demo has no real account to delete.");
  if (confirmation !== "DELETE") throw new Error("Type DELETE to confirm.");
  await rpc("request_account_deletion", { p_confirmation: confirmation });
}
