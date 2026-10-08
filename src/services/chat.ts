/**
 * Chat service — milestone 3.
 * Planned: Supabase Realtime channels per booking/thread,
 * messages table with sender/booking scoping.
 */
export type ChatThread = {
  id: string;
  bookingId: string;
  otherPartyName: string;
  lastMessage: string;
  updatedAt: string;
  unread: number;
};

export async function listThreads(_userId: string): Promise<ChatThread[]> {
  return [];
}

export async function sendMessage(_threadId: string, _senderId: string, _body: string): Promise<void> {
  // Milestone 3.
}
