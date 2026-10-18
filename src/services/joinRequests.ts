import { getSupabase, isSupabaseConfigured, isDemoMode } from "./supabase";
import { mockPosts } from "../data/mock";
import { DbJoinRequest, JoinRequest, NeedPost, toJoinRequest } from "./mappers";

const useMock = () => {
  if (isDemoMode()) return true;
  if (!isSupabaseConfigured)
    throw new Error("Backend not configured. Choose demo mode to preview.");
  return false;
};

/** In-memory store for demo mode (module state, reset on reload). */
const mockRequests: JoinRequest[] = [];

function withRequester(row: Record<string, unknown>): JoinRequest {
  return toJoinRequest({
    ...(row as unknown as DbJoinRequest),
    requester: { display_name: (row.requester_name as string) ?? "Someone" },
  });
}

async function requesterName(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  return (data as { display_name?: string } | null)?.display_name ?? "Someone";
}

/**
 * Request to join a post. Guards (client-side, mirrored by RLS + RPC):
 * no self-join, no duplicates, post must be open and unexpired.
 */
export async function requestToJoin(
  postId: string,
  requesterId: string,
): Promise<JoinRequest> {
  if (useMock()) {
    const post = mockPosts.find((p) => p.id === postId);
    if (!post) throw new Error("Post not found.");
    if (post.authorId === requesterId)
      throw new Error("You can't join your own post.");
    if (
      post.status !== "open" ||
      post.spotsLeft < 1 ||
      new Date(post.startsAt).getTime() <= Date.now() ||
      (post.expiresAt && new Date(post.expiresAt).getTime() <= Date.now())
    )
      throw new Error("Post is full, closed or expired.");
    const existing = mockRequests.find(
      (r) => r.postId === postId && r.requesterId === requesterId,
    );
    if (existing?.status === "pending" || existing?.status === "approved")
      throw new Error("You have already requested to join this post.");
    if (existing) mockRequests.splice(mockRequests.indexOf(existing), 1);
    const req: JoinRequest = {
      id: `mock-jr-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      postId,
      requesterId,
      requesterName: "You",
      status: "pending",
      declineCount: 0,
      createdAt: new Date().toISOString(),
    };
    mockRequests.unshift(req);
    return req;
  }
  const supabase = getSupabase()!;
  const { data, error } = await supabase.rpc("request_join", {
    p_post_id: postId,
  });
  if (error) throw new Error(friendlyRequestError(error.message));
  const row = data as Record<string, unknown>;
  const req = row.requester as { display_name?: string } | null;
  const created = toJoinRequest({
    ...(row as unknown as DbJoinRequest),
    requester: {
      display_name:
        req?.display_name ?? (await requesterName(supabase, requesterId)),
    },
  });
  return created;
}

/** Withdraw my pending request. Approved joins are released via cancelParticipation. */
export async function withdrawRequest(requestId: string): Promise<void> {
  if (useMock()) {
    return cancelParticipation(requestId);
  }
  const supabase = getSupabase()!;
  const { error } = await supabase.rpc("withdraw_join_request", {
    p_request_id: requestId,
  });
  if (error) throw new Error(error.message);
}

/**
 * Leave an activity I was approved for. Releases capacity; a post closed by
 * filling up reopens via the reopen_post_if_space trigger.
 */
export async function cancelParticipation(requestId: string): Promise<void> {
  if (useMock()) {
    const r = mockRequests.find((x) => x.id === requestId);
    if (!r || !["pending", "approved"].includes(r.status))
      throw new Error("Request cannot be withdrawn.");
    const p = mockPosts.find((p) => p.id === r.postId);
    if (r.status === "approved" && p) {
      p.joinedCount = Math.max(0, p.joinedCount - 1);
      p.spotsLeft = Math.max(0, p.vacancies - p.joinedCount);
      if (
        p.status === "closed" &&
        p.spotsLeft > 0 &&
        new Date(p.expiresAt ?? p.startsAt).getTime() > Date.now() &&
        new Date(p.startsAt).getTime() > Date.now()
      )
        p.status = "open";
    }
    r.status = "withdrawn";
    return;
  }
  const supabase = getSupabase()!;
  const { error } = await supabase.rpc("withdraw_join_request", {
    p_request_id: requestId,
  });
  if (error) throw new Error(error.message);
}

/**
 * Host approves a request. Atomic: approve_join_request() locks the post row,
 * so concurrent approvals serialize and can never overfill.
 */
export async function approveRequest(
  requestId: string,
): Promise<{ spotsLeft: number; postClosed: boolean }> {
  if (useMock()) {
    const r = mockRequests.find((x) => x.id === requestId);
    if (!r) throw new Error("Request not found.");
    const p = mockPosts.find((p) => p.id === r.postId);
    if (
      !p ||
      p.status !== "open" ||
      p.spotsLeft < 1 ||
      new Date(p.expiresAt ?? p.startsAt).getTime() <= Date.now()
    )
      throw new Error("Post is full, closed or expired.");
    if (r.status !== "pending") throw new Error("Request is not pending.");
    r.status = "approved";
    p.joinedCount++;
    p.spotsLeft = Math.max(0, p.vacancies - p.joinedCount);
    if (p.spotsLeft === 0) p.status = "closed";
    return { spotsLeft: p.spotsLeft, postClosed: p.status === "closed" };
  }
  const supabase = getSupabase()!;
  const { data, error } = await supabase.rpc("approve_join_request", {
    p_request_id: requestId,
  });
  if (error) throw new Error(friendlyRequestError(error.message));
  const res = data as { spots_left: number; post_closed: boolean };
  return { spotsLeft: res.spots_left, postClosed: res.post_closed };
}

/** Host declines a pending request through the authorized RPC. */
export async function declineRequest(requestId: string): Promise<void> {
  if (useMock()) {
    const r = mockRequests.find((x) => x.id === requestId);
    if (!r || r.status !== "pending")
      throw new Error("Request is not pending.");
    r.status = "declined";
    return;
  }
  const supabase = getSupabase()!;
  const { error } = await supabase.rpc("decline_join_request", {
    p_request_id: requestId,
  });
  if (error) throw new Error(error.message);
}

/** All requests for a post (host view), with requester names. */
export async function listRequestsForPost(
  postId: string,
): Promise<JoinRequest[]> {
  if (useMock()) return mockRequests.filter((r) => r.postId === postId);
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from("join_requests")
    .select(
      "*, requester:profiles!join_requests_requester_id_fkey(display_name)",
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const req = row.requester as { display_name?: string } | null;
    return toJoinRequest({
      ...(row as unknown as DbJoinRequest),
      requester: { display_name: req?.display_name ?? "Someone" },
    });
  });
}

/** My requests across posts, with post titles for context. */
export type MyJoinRequest = JoinRequest & {
  postTitle: string;
  postStatus?: NeedPost["status"];
  postStartsAt?: string;
};
export async function listMyRequests(
  requesterId: string,
): Promise<MyJoinRequest[]> {
  if (useMock())
    return mockRequests
      .filter((r) => r.requesterId === requesterId)
      .map((r) => ({
        ...r,
        postTitle: mockPosts.find((p) => p.id === r.postId)?.title ?? "Post",
        postStatus: mockPosts.find((p) => p.id === r.postId)?.status,
        postStartsAt: mockPosts.find((p) => p.id === r.postId)?.startsAt,
      }));
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from("join_requests")
    .select("*, post:posts!join_requests_post_id_fkey(title,status,starts_at)")
    .eq("requester_id", requesterId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const post = row.post as {
      title?: string;
      status?: NeedPost["status"];
      starts_at?: string;
    } | null;
    return {
      ...withRequester(row),
      postTitle: post?.title ?? "Post",
      postStatus: post?.status,
      postStartsAt: post?.starts_at,
    };
  });
}

/** My pending/approved request for one post, if any. */
export async function myRequestForPost(
  postId: string,
  requesterId: string,
): Promise<JoinRequest | null> {
  if (useMock())
    return (
      mockRequests.find(
        (r) => r.postId === postId && r.requesterId === requesterId,
      ) ?? null
    );
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from("join_requests")
    .select("*")
    .eq("post_id", postId)
    .eq("requester_id", requesterId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as unknown as DbJoinRequest;
  return toJoinRequest({
    ...row,
    requester: { display_name: await requesterName(supabase, requesterId) },
  });
}

function friendlyRequestError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("duplicate") || m.includes("unique"))
    return "You have already requested to join this post.";
  if (m.includes("own post")) return "You can't join your own post.";
  if (m.includes("not open")) return "This post is no longer open.";
  if (m.includes("expired")) return "This post has expired.";
  if (m.includes("full")) return "This post is already full.";
  if (m.includes("not pending")) return "This request was already handled.";
  if (m.includes("only the host")) return "Only the host can approve requests.";
  return message;
}
