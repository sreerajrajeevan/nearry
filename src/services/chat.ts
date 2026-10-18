import { getSupabase, isSupabaseConfigured, isDemoMode } from "./supabase";
import { notifyUnreadChanged } from "./unreadEvents";
import { multiplexSubscribe } from "./realtime";
import { mockConversations, mockMessages } from "../data/mock";
import {
  ChatMessage,
  Conversation,
  DbMessage,
  toChatMessage,
  toConversation,
} from "./mappers";

const useMock = () => {
  if (isDemoMode()) return true;
  if (!isSupabaseConfigured)
    throw new Error("Backend not configured. Choose demo mode to preview.");
  return false;
};

export function validateMessageBody(body: string): string | null {
  const t = body.trim();
  if (t.length === 0) return "Write something first.";
  if (t.length > 2000) return "Keep it under 2000 characters.";
  return null;
}

/**
 * Open (or fetch) the 1:1 conversation with another user, scoped to a post
 * (author <-> approved participant) or a booking (customer <-> business).
 * The server enforces the authorization.
 */
export async function getOrCreateConversation(
  otherUserId: string,
  ctx: { postId: string } | { bookingId: string },
): Promise<string> {
  if (useMock()) {
    const existing = mockConversations.find(
      (c) =>
        c.otherUserId === otherUserId &&
        ("postId" in ctx
          ? c.postId === ctx.postId
          : c.bookingId === ctx.bookingId),
    );
    if (existing) return existing.id;
    const created: Conversation = {
      id: `mock-conv-${Date.now()}`,
      otherUserId,
      otherName: "Demo User",
      ...ctx,
      contextTitle: "Demo chat",
      unreadCount: 0,
    };
    mockConversations.unshift(created);
    return created.id;
  }
  const supabase = getSupabase()!;
  const { data, error } = await supabase.rpc("get_or_create_conversation", {
    p_other_user: otherUserId,
    p_post_id: "postId" in ctx ? ctx.postId : null,
    p_booking_id: "bookingId" in ctx ? ctx.bookingId : null,
  });
  if (error) throw new Error(friendlyChatError(error.message));
  return data as string;
}

/** Chat list with last message + unread counts, newest first. */
export async function listConversations(): Promise<Conversation[]> {
  // Return snapshots, as the live RPC does, so read/sent mutations refresh lists.
  if (useMock())
    return mockConversations.map((conversation) => ({ ...conversation }));
  const supabase = getSupabase()!;
  const { data, error } = await supabase.rpc("list_my_conversations");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(toConversation);
}

/** Total unread messages across conversations (for badges). */
export async function unreadMessageCount(): Promise<number> {
  const list = await listConversations();
  return list.reduce((sum, c) => sum + c.unreadCount, 0);
}

export async function listMessages(
  conversationId: string,
  myId: string,
): Promise<ChatMessage[]> {
  if (useMock()) {
    return mockMessages
      .filter((m) => m.conversationId === conversationId)
      .map((m) => ({ ...m, mine: m.senderId === myId }));
  }
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from("messages")
    .select("*, sender:profiles!messages_sender_id_fkey(display_name)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return ((data ?? []) as DbMessage[])
    .reverse()
    .map((m) => toChatMessage(m, myId));
}

/** Send a message; the server queues its notification and push delivery. */
export async function sendMessage(
  conversationId: string,
  myId: string,
  body: string,
): Promise<ChatMessage> {
  const err = validateMessageBody(body);
  if (err) throw new Error(err);
  const text = body.trim();
  if (useMock()) {
    const msg: ChatMessage = {
      id: `mock-msg-${Date.now()}`,
      conversationId,
      senderId: myId,
      senderName: "You",
      body: text,
      createdAt: new Date().toISOString(),
      mine: true,
    };
    mockMessages.push(msg);
    const conv = mockConversations.find((c) => c.id === conversationId);
    if (conv) {
      conv.lastBody = text;
      conv.lastAt = msg.createdAt;
    }
    return msg;
  }
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: myId, body: text })
    .select("*, sender:profiles!messages_sender_id_fkey(display_name)")
    .single();
  if (error) throw new Error(error.message);
  const msg = toChatMessage(data as DbMessage, myId);
  return msg;
}

export async function markConversationRead(
  conversationId: string,
  lastMessageId?: string,
): Promise<void> {
  if (useMock()) {
    const conv = mockConversations.find((c) => c.id === conversationId);
    if (conv) conv.unreadCount = 0;
    notifyUnreadChanged();
    return;
  }
  if (!lastMessageId) return;
  const supabase = getSupabase()!;
  const { error } = await supabase.rpc("mark_conversation_read", {
    p_conversation_id: conversationId,
    p_last_message_id: lastMessageId,
  });
  if (error) throw new Error(error.message);
  notifyUnreadChanged();
}

/** Realtime subscription for new messages in a conversation. */
export function subscribeToConversation(
  conversationId: string,
  onChange: () => void,
): () => void {
  if (useMock()) return () => {};
  return multiplexSubscribe(
    `conv-${conversationId}`,
    (ch, fire) =>
      ch.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => fire(),
      ),
    onChange,
  );
}

function friendlyChatError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("not allowed"))
    return "You can only chat once a request is approved or a booking exists.";
  if (m.includes("yourself")) return "You can't chat with yourself.";
  return message;
}
