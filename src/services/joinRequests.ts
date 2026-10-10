import { getSupabase, isSupabaseConfigured, isDemoMode } from './supabase';
import { DbJoinRequest, JoinRequest, toJoinRequest } from './mappers';

const useMock = () => isDemoMode() || !isSupabaseConfigured;

/** In-memory store for demo mode (module state, reset on reload). */
const mockRequests: JoinRequest[] = [];

function withRequester(row: Record<string, unknown>): JoinRequest {
  return toJoinRequest({
    ...(row as unknown as DbJoinRequest),
    requester: { display_name: (row.requester_name as string) ?? 'Someone' },
  });
}

async function requesterName(supabase: NonNullable<ReturnType<typeof getSupabase>>, userId: string): Promise<string> {
  const { data } = await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle();
  return (data as { display_name?: string } | null)?.display_name ?? 'Someone';
}

/**
 * Request to join a post. Guards (client-side, mirrored by RLS + RPC):
 * no self-join, no duplicates, post must be open and unexpired.
 */
export async function requestToJoin(postId: string, requesterId: string): Promise<JoinRequest> {
  if (useMock()) {
    const existing = mockRequests.find((r) => r.postId === postId && r.requesterId === requesterId);
    if (existing?.status === 'pending') throw new Error('You have already requested to join this post.');
    if (existing) mockRequests.splice(mockRequests.indexOf(existing), 1);
    const req: JoinRequest = {
      id: `mock-jr-${Date.now()}`,
      postId,
      requesterId,
      requesterName: 'You',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    mockRequests.unshift(req);
    return req;
  }
  const supabase = getSupabase()!;
  // A declined/withdrawn request can be replaced by a fresh one.
  const { data: existing } = await supabase
    .from('join_requests')
    .select('id,status')
    .eq('post_id', postId)
    .eq('requester_id', requesterId)
    .maybeSingle();
  const ex = existing as { id: string; status: string } | null;
  if (ex?.status === 'pending') throw new Error('You have already requested to join this post.');
  if (ex) {
    const { error: delError } = await supabase.from('join_requests').delete().eq('id', ex.id);
    if (delError) throw new Error(delError.message);
  }
  const { data, error } = await supabase
    .from('join_requests')
    .insert({ post_id: postId, requester_id: requesterId, status: 'pending' })
    .select('*, requester:profiles!join_requests_requester_id_fkey(display_name)')
    .single();
  if (error) throw new Error(friendlyRequestError(error.message));
  const row = data as Record<string, unknown>;
  const req = row.requester as { display_name?: string } | null;
  return toJoinRequest({
    ...(row as unknown as DbJoinRequest),
    requester: { display_name: req?.display_name ?? (await requesterName(supabase, requesterId)) },
  });
}

/** Withdraw my pending request. Approved joins are released via cancelParticipation. */
export async function withdrawRequest(requestId: string): Promise<void> {
  if (useMock()) {
    const i = mockRequests.findIndex((r) => r.id === requestId);
    if (i >= 0) mockRequests.splice(i, 1);
    return;
  }
  const supabase = getSupabase()!;
  const { error } = await supabase.from('join_requests').delete().eq('id', requestId);
  if (error) throw new Error(error.message);
}

/**
 * Leave an activity I was approved for. Releases capacity; a post closed by
 * filling up reopens via the reopen_post_if_space trigger.
 */
export async function cancelParticipation(requestId: string): Promise<void> {
  if (useMock()) {
    const r = mockRequests.find((x) => x.id === requestId);
    if (r) r.status = 'withdrawn';
    return;
  }
  const supabase = getSupabase()!;
  const { error } = await supabase
    .from('join_requests')
    .update({ status: 'withdrawn' })
    .eq('id', requestId);
  if (error) throw new Error(error.message);
}

/**
 * Host approves a request. Atomic: approve_join_request() locks the post row,
 * so concurrent approvals serialize and can never overfill.
 */
export async function approveRequest(requestId: string): Promise<{ spotsLeft: number; postClosed: boolean }> {
  if (useMock()) {
    const r = mockRequests.find((x) => x.id === requestId);
    if (!r) throw new Error('Request not found.');
    r.status = 'approved';
    return { spotsLeft: 0, postClosed: false };
  }
  const supabase = getSupabase()!;
  const { data, error } = await supabase.rpc('approve_join_request', { p_request_id: requestId });
  if (error) throw new Error(friendlyRequestError(error.message));
  const res = data as { spots_left: number; post_closed: boolean };
  return { spotsLeft: res.spots_left, postClosed: res.post_closed };
}

/** Host declines a request. Direct update allowed (RLS blocks 'approved'). */
export async function declineRequest(requestId: string): Promise<void> {
  if (useMock()) {
    const r = mockRequests.find((x) => x.id === requestId);
    if (r) r.status = 'declined';
    return;
  }
  const supabase = getSupabase()!;
  const { error } = await supabase
    .from('join_requests')
    .update({ status: 'declined' })
    .eq('id', requestId);
  if (error) throw new Error(error.message);
}

/** All requests for a post (host view), with requester names. */
export async function listRequestsForPost(postId: string): Promise<JoinRequest[]> {
  if (useMock()) return mockRequests.filter((r) => r.postId === postId);
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from('join_requests')
    .select('*, requester:profiles!join_requests_requester_id_fkey(display_name)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const req = row.requester as { display_name?: string } | null;
    return toJoinRequest({
      ...(row as unknown as DbJoinRequest),
      requester: { display_name: req?.display_name ?? 'Someone' },
    });
  });
}

/** My requests across posts, with post titles for context. */
export async function listMyRequests(requesterId: string): Promise<(JoinRequest & { postTitle: string })[]> {
  if (useMock())
    return mockRequests
      .filter((r) => r.requesterId === requesterId)
      .map((r) => ({ ...r, postTitle: 'Demo post' }));
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from('join_requests')
    .select('*, post:posts!join_requests_post_id_fkey(title)')
    .eq('requester_id', requesterId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const post = row.post as { title?: string } | null;
    return { ...withRequester(row), postTitle: post?.title ?? 'Post' };
  });
}

/** My pending/approved request for one post, if any. */
export async function myRequestForPost(postId: string, requesterId: string): Promise<JoinRequest | null> {
  if (useMock())
    return mockRequests.find((r) => r.postId === postId && r.requesterId === requesterId) ?? null;
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from('join_requests')
    .select('*')
    .eq('post_id', postId)
    .eq('requester_id', requesterId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as unknown as DbJoinRequest;
  return toJoinRequest({ ...row, requester: { display_name: await requesterName(supabase, requesterId) } });
}

function friendlyRequestError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('duplicate') || m.includes('unique')) return 'You have already requested to join this post.';
  if (m.includes('own post')) return "You can't join your own post.";
  if (m.includes('not open')) return 'This post is no longer open.';
  if (m.includes('expired')) return 'This post has expired.';
  if (m.includes('full')) return 'This post is already full.';
  if (m.includes('not pending')) return 'This request was already handled.';
  if (m.includes('only the host')) return 'Only the host can approve requests.';
  return message;
}
