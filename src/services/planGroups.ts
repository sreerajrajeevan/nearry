import { isDemoMode, requireSupabase } from "./supabase";
import { mockPosts } from "../data/mock";
import {
  cancelParticipation,
  demoApprovedPlanMembers,
  myRequestForPost,
} from "./joinRequests";
import { subscribeToPosts } from "./posts";
import { multiplexSubscribe } from "./realtime";
import { notifyUnreadChanged } from "./unreadEvents";
import { validateMessageBody } from "./chat";
export type PlanGroup = {
  id: string;
  postId: string;
  name: string;
  hostId: string;
  planTitle: string;
  cancelled: boolean;
  memberCount: number;
  members?: { id: string; name: string; host: boolean }[];
  lastBody?: string;
  lastAt?: string;
  unreadCount?: number;
};
export type PlanGroupMessage = {
  id: string;
  seq: number;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
  mine: boolean;
};
const names = new Map<string, string>(),
  demoMessages = new Map<string, PlanGroupMessage[]>(),
  read = new Map<string, number>();
const message = (row: any, userId: string): PlanGroupMessage => ({
  id: row.id,
  seq: Number(row.seq),
  senderId: row.sender_id,
  senderName: row.sender?.display_name ?? row.sender_name ?? "Member",
  body: row.body,
  createdAt: row.created_at,
  mine: row.sender_id === userId,
});
async function rpc(name: string, params?: Record<string, unknown>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let result;
  try {
    result = await requireSupabase()
      .rpc(name, params)
      .abortSignal(controller.signal);
  } finally {
    clearTimeout(timer);
  }
  const { data, error } = result;
  if (error) throw new Error(error.message);
  return data;
}
function demoGroup(postId: string, userId: string): PlanGroup {
  const p = mockPosts.find((p) => p.id === postId);
  if (!p) throw new Error("Plan not found.");
  const members = [
    { id: p.authorId, name: p.authorName, host: true },
    ...demoApprovedPlanMembers(postId),
  ];
  if (!members.some((m) => m.id === userId))
    throw new Error("This group is only for approved plan members.");
  const id = "plan-" + p.id,
    messages = demoMessages.get(id) ?? [];
  return {
    id,
    postId: p.id,
    hostId: p.authorId,
    name: names.get(id) ?? p.title,
    planTitle: p.title,
    cancelled: p.status === "cancelled",
    memberCount: members.length,
    members,
    lastBody: messages.at(-1)?.body,
    lastAt: messages.at(-1)?.createdAt,
    unreadCount: messages.filter(
      (m) => m.senderId !== userId && m.seq > (read.get(id + userId) ?? 0),
    ).length,
  };
}
export async function listPlanGroups(myId: string): Promise<PlanGroup[]> {
  if (isDemoMode())
    return mockPosts.flatMap((p) => {
      try {
        return [demoGroup(p.id, myId)];
      } catch {
        return [];
      }
    });
  return (await rpc("list_my_plan_groups")) ?? [];
}
export type GroupAddress = {
  groupId?: string;
  postId?: string;
  messageId?: string;
};
export async function getPlanGroup(
  address: GroupAddress,
  myId: string,
): Promise<PlanGroup> {
  if (isDemoMode())
    return demoGroup(
      address.postId ?? address.groupId?.replace(/^plan-/, "") ?? "",
      myId,
    );
  return rpc("get_plan_group", {
    p_group_id: address.groupId ?? null,
    p_post_id: address.postId ?? null,
    p_message_id: address.messageId ?? null,
  });
}
export async function renamePlanGroup(id: string, name: string, myId: string) {
  if (name.trim().length < 2 || name.trim().length > 80)
    throw new Error("Use a group name between 2 and 80 characters.");
  if (isDemoMode()) {
    const g = await getPlanGroup({ groupId: id }, myId);
    if (g.hostId !== myId)
      throw new Error("Only the host can rename this group.");
    names.set(id, name.trim());
    return;
  }
  await rpc("rename_plan_group", { p_group_id: id, p_name: name.trim() });
}
export async function leavePlanGroup(id: string, myId: string) {
  if (isDemoMode()) {
    const g = await getPlanGroup({ groupId: id }, myId);
    if (g.hostId === myId)
      throw new Error("The host cannot leave their own plan.");
    const r = await myRequestForPost(g.postId, myId);
    if (r) await cancelParticipation(r.id);
  } else await rpc("leave_plan_group", { p_group_id: id });
  notifyUnreadChanged();
}
export async function listPlanGroupMessages(
  id: string,
  myId: string,
  beforeSeq?: number,
  pageSize = 60,
): Promise<PlanGroupMessage[]> {
  if (isDemoMode()) {
    await getPlanGroup({ groupId: id }, myId);
    return (demoMessages.get(id) ?? [])
      .filter((m) => beforeSeq == null || m.seq < beforeSeq)
      .slice(-pageSize)
      .map((m) => ({ ...m, mine: m.senderId === myId }));
  }
  let query = requireSupabase()
    .from("plan_group_messages")
    .select(
      "*,sender:profiles!plan_group_messages_sender_id_fkey(display_name)",
    )
    .eq("group_id", id)
    .order("seq", { ascending: false })
    .limit(Math.min(500, Math.max(1, pageSize)));
  if (beforeSeq != null) query = query.lt("seq", beforeSeq);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).reverse().map((row) => message(row, myId));
}
export async function sendPlanGroupMessage(
  id: string,
  myId: string,
  body: string,
  clientKey: string,
): Promise<PlanGroupMessage> {
  const error = validateMessageBody(body);
  if (error) throw new Error(error);
  if (isDemoMode()) {
    const g = await getPlanGroup({ groupId: id }, myId);
    if (g.cancelled) throw new Error("This plan was cancelled.");
    const all = demoMessages.get(id) ?? [];
    const prior = all.find((m) => m.id === clientKey);
    if (prior) return prior;
    const m = {
      id: clientKey,
      seq: all.length + 1,
      senderId: myId,
      senderName: "You",
      body: body.trim(),
      createdAt: new Date().toISOString(),
      mine: true,
    };
    all.push(m);
    demoMessages.set(id, all);
    return m;
  }
  return message(
    await rpc("send_plan_group_message", {
      p_group_id: id,
      p_body: body.trim(),
      p_client_key: clientKey,
    }),
    myId,
  );
}
export async function markPlanGroupRead(
  id: string,
  myId: string,
  last: PlanGroupMessage,
) {
  if (isDemoMode())
    read.set(id + myId, Math.max(read.get(id + myId) ?? 0, last.seq));
  else
    await rpc("mark_plan_group_read", {
      p_group_id: id,
      p_last_message_id: last.id,
    });
  notifyUnreadChanged();
}
export function subscribeToPlanGroup(id: string, onChange: () => void) {
  if (isDemoMode()) return () => {};
  const messages = multiplexSubscribe(
    "plan-group-" + id,
    (channel, fire) =>
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "plan_group_messages",
          filter: "group_id=eq." + id,
        },
        () => fire(),
      ),
    onChange,
  );
  const members = subscribeToPosts(onChange);
  return () => {
    messages();
    members();
  };
}
