import { parsePage, Page, Cursor } from "../utils/pagination";
import { DbPost, toNeedPost } from "./mappers";
import { requestPresentation } from "../utils/activity";
import { assertLive } from "./demoGuard";
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
export const JOIN_NOTE_MAX = 280;
/** Trimmed note, or undefined when the requester left it blank. */
export function cleanJoinNote(note?: string) {
  const value = note?.trim();
  if (!value) return undefined;
  if (value.length > JOIN_NOTE_MAX)
    throw new Error(`Keep your note under ${JOIN_NOTE_MAX} characters.`);
  return value;
}

export async function requestToJoin(
  postId: string,
  requesterId: string,
  note?: string,
): Promise<JoinRequest> {
  assertLive("join plans");
  const cleanNote = cleanJoinNote(note);
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
      ...(cleanNote ? { note: cleanNote } : {}),
    };
    mockRequests.unshift(req);
    return req;
  }
  const supabase = getSupabase()!;
  const { data, error } = await supabase.rpc("request_join", {
    p_post_id: postId,
    // Only send a note when there is one, so a plain join still works
    // against a database that has not applied migration 00039 yet.
    ...(cleanNote ? { p_note: cleanNote } : {}),
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
  assertLive("withdraw requests");
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
  assertLive("leave plans");
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
  assertLive("approve requests");
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
  assertLive("decline requests");
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
      "*, requester:profiles!join_requests_requester_id_fkey(display_name,avatar_url)",
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const req = row.requester as {
      display_name?: string;
      avatar_url?: string | null;
    } | null;
    return toJoinRequest({
      ...(row as unknown as DbJoinRequest),
      requester: {
        display_name: req?.display_name ?? "Someone",
        avatar_url: req?.avatar_url ?? null,
      },
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

/** Pending requests across every post I host, newest first (Messages screen). */
export type HostJoinRequest = JoinRequest & {
  postTitle: string;
  postStartsAt?: string;
  postVenueName?: string;
};
export async function listPendingRequestsForHost(
  hostId: string,
): Promise<HostJoinRequest[]> {
  if (useMock())
    return mockRequests
      .filter((r) => {
        const post = mockPosts.find((p) => p.id === r.postId);
        return (
          r.status === "pending" &&
          post?.authorId === hostId &&
          post.status !== "cancelled" &&
          new Date(post.startsAt).getTime() > Date.now() &&
          (!post.expiresAt || new Date(post.expiresAt).getTime() > Date.now())
        );
      })
      .slice(0, 100)
      .map((r) => {
        const p = mockPosts.find((x) => x.id === r.postId);
        return {
          ...r,
          postTitle: p?.title ?? "Post",
          postStartsAt: p?.startsAt,
          postVenueName: p?.venueName,
        };
      });
  const supabase = getSupabase()!;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let result;
  try {
    result = await supabase
      .from("join_requests")
      .select(
        "*, requester:profiles!join_requests_requester_id_fkey(display_name,avatar_url), post:posts!join_requests_post_id_fkey!inner(title,starts_at,venue_name,author_id)",
      )
      .eq("status", "pending")
      .eq("post.author_id", hostId)
      .in("post.status", ["open", "closed"])
      .gt("post.starts_at", new Date().toISOString())
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`, {
        referencedTable: "post",
      })
      .order("created_at", { ascending: false })
      .limit(100)
      .abortSignal(controller.signal);
  } finally {
    clearTimeout(timer);
  }
  const { data, error } = result;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const req = row.requester as {
      display_name?: string;
      avatar_url?: string | null;
    } | null;
    const post = row.post as {
      title?: string;
      starts_at?: string;
      venue_name?: string;
    } | null;
    return {
      ...toJoinRequest({
        ...(row as unknown as DbJoinRequest),
        requester: {
          display_name: req?.display_name ?? "Someone",
          avatar_url: req?.avatar_url ?? null,
        },
      }),
      postTitle: post?.title ?? "Post",
      postStartsAt: post?.starts_at,
      postVenueName: post?.venue_name ?? undefined,
    };
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

/** Derived demo roster; the real group service uses approved rows in SQL. */
export function demoApprovedPlanMembers(postId: string) {
  return mockRequests
    .filter((r) => r.postId === postId && r.status === "approved")
    .map((r) => ({ id: r.requesterId, name: r.requesterName, host: false }));
}

export async function listMyRequestsPage(
  id: string,
  history: boolean,
  cursor: Cursor | null = null,
): Promise<Page<MyJoinRequest>> {
  if (useMock()) {
    const all = (await listMyRequests(id)).filter(
      (r) => requestPresentation(r).history === history,
    );
    const start = cursor ? all.findIndex((r) => r.id === cursor.id) + 1 : 0,
      items = all.slice(start, start + 30),
      last = items.at(-1);
    return {
      items,
      cursor:
        start + items.length < all.length && last
          ? { at: last.createdAt, id: last.id }
          : null,
    };
  }
  const { data, error } = await getSupabase()!.rpc("activity_requests", {
    p_history: history,
    p_cursor: cursor,
    p_limit: 30,
  });
  if (error) throw new Error(error.message);
  const page = parsePage(data);
  return {
    items: page.items.map((r) => ({
      ...withRequester(r),
      postTitle: String(r.post_title ?? "Plan"),
      postStatus: r.post_status as NeedPost["status"],
      postStartsAt: r.post_starts_at as string | undefined,
    })),
    cursor: page.cursor,
  };
}
export async function listHostRequestPage(
  id: string,
  cursor: Cursor | null = null,
): Promise<Page<JoinRequest & { post: NeedPost }>> {
  if (useMock()) {
    const all = await listPendingRequestsForHost(id),
      start = cursor ? all.findIndex((r) => r.id === cursor.id) + 1 : 0,
      rows = all.slice(start, start + 30),
      last = rows.at(-1);
    return {
      items: rows.flatMap((r) => {
        const post = mockPosts.find((p) => p.id === r.postId);
        return post ? [{ ...r, post }] : [];
      }),
      cursor:
        start + rows.length < all.length && last
          ? { at: last.createdAt, id: last.id }
          : null,
    };
  }
  const { data, error } = await getSupabase()!.rpc("host_request_page", {
    p_cursor: cursor,
    p_limit: 30,
  });
  if (error) throw new Error(error.message);
  const page = parsePage(data);
  return {
    items: page.items.map((r) => ({
      ...toJoinRequest({
        ...(r as unknown as DbJoinRequest),
        requester: {
          display_name: String(r.requester_name ?? "Someone"),
          avatar_url: r.requester_avatar as string | null,
        },
      }),
      post: toNeedPost(r.post as DbPost),
    })),
    cursor: page.cursor,
  };
}
