import { getSupabase, isSupabaseConfigured } from './supabase';

/**
 * Join-request service — milestone 2.
 * Flow: user requests to join a Need-People post → author approves/declines.
 * Vacancy auto-close: when approved count reaches vacancies, post closes
 * (enforced server-side; see supabase/schema.sql).
 */
export type JoinRequest = {
  id: string;
  postId: string;
  requesterId: string;
  requesterName: string;
  status: 'pending' | 'approved' | 'declined';
  createdAt: string;
};

export async function requestToJoin(postId: string, requesterId: string): Promise<JoinRequest> {
  if (isSupabaseConfigured) {
    const supabase = getSupabase()!;
    const { data, error } = await supabase
      .from('join_requests')
      .insert({ post_id: postId, requester_id: requesterId, status: 'pending' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as JoinRequest;
  }
  return {
    id: `mock-jr-${Date.now()}`,
    postId,
    requesterId,
    requesterName: 'You',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
}

export async function listJoinRequests(_postId: string): Promise<JoinRequest[]> {
  // Milestone 2: query join_requests by post_id with requester profile join.
  return [];
}
