import { listPlanGroups } from "./planGroups";
import { requireSupabase, isDemoMode } from "./supabase";
import { mockConversations, mockNotifications } from "../data/mock";

export type UnreadCounts = {
  messages: number;
  notifications: number;
  activity: number;
};
export async function getUnreadCounts(myId?: string): Promise<UnreadCounts> {
  if (isDemoMode()) {
    const groups = myId ? await listPlanGroups(myId) : [];
    const messages =
      mockConversations.reduce((n, c) => n + c.unreadCount, 0) +
      groups.reduce((n, g) => n + (g.unreadCount ?? 0), 0);
    const unread = mockNotifications.filter((n) => !n.read);
    return {
      messages,
      notifications: unread.length,
      activity: messages + unread.filter((n) => n.kind !== "message").length,
    };
  }
  const { data, error } = await requireSupabase().rpc("unread_counts");
  if (error) throw new Error(error.message);
  const messages = Number(data.messages),
    notifications = Number(data.notifications);
  return {
    messages,
    notifications,
    activity: messages + Number(data.other_notifications),
  };
}
