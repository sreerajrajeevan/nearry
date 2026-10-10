import { getSupabase, isSupabaseConfigured, isDemoMode } from './supabase';
import { mockPosts } from '../data/mock';
import {
  DbPost,
  NeedPost,
  NewPostInput,
  toDbNewPost,
  toNeedPost,
} from './mappers';
import { validatePostDraft } from '../utils/validation';

const useMock = () => isDemoMode() || !isSupabaseConfigured;

export type PostFilter = {
  search?: string;
  tag?: string;
  /** Defaults to open posts only. */
  status?: 'open' | 'closed' | 'cancelled' | 'all';
  authorId?: string;
};

/** Map a post_cards view row (flat author_name) through the canonical mapper. */
function toCard(row: Record<string, unknown>): NeedPost {
  return toNeedPost({
    ...(row as unknown as DbPost),
    author: { display_name: (row.author_name as string) ?? 'Someone' },
    approved_count: Number(row.approved_count ?? 0),
  });
}

/**
 * Open posts, newest first. Expired-but-still-open rows are filtered out —
 * expiry never depends on the close_expired_posts() cron alone.
 */
export async function listPosts(filter: PostFilter = {}): Promise<NeedPost[]> {
  if (useMock()) {
    let posts = [...mockPosts];
    if (filter.authorId) posts = posts.filter((p) => p.authorId === filter.authorId);
    if (filter.tag) posts = posts.filter((p) => p.tags.includes(filter.tag!));
    const q = filter.search?.trim().toLowerCase();
    if (q) {
      posts = posts.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.venueName ?? '').toLowerCase().includes(q),
      );
    }
    return posts;
  }
  const supabase = getSupabase()!;
  let req = supabase
    .from('post_cards')
    .select('*')
    .or('expires_at.is.null,expires_at.gt.now()')
    .order('starts_at', { ascending: true });
  if (filter.status && filter.status !== 'all') req = req.eq('status', filter.status);
  else if (!filter.status) req = req.eq('status', 'open');
  if (filter.authorId) req = req.eq('author_id', filter.authorId);
  if (filter.tag) req = req.filter('tags', 'cs', `{${filter.tag}}`);
  const q = filter.search?.trim();
  if (q) req = req.or(`title.ilike.%${q}%,description.ilike.%${q}%,venue_name.ilike.%${q}%`);
  const { data, error } = await req;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(toCard);
}

export async function getPost(id: string): Promise<NeedPost | null> {
  if (useMock()) return mockPosts.find((p) => p.id === id) ?? null;
  const supabase = getSupabase()!;
  const { data, error } = await supabase.from('post_cards').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toCard(data as Record<string, unknown>) : null;
}

/** Create a post. Client-validated first; DB CHECKs are the backstop. */
export async function createPost(authorId: string, input: NewPostInput): Promise<NeedPost> {
  const err = validatePostDraft({
    title: input.title,
    description: input.description,
    startsAt: new Date(input.startsAt),
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    vacancies: input.vacancies,
    costCents: input.costCents,
  });
  if (err) throw new Error(err);

  if (useMock()) {
    const created: NeedPost = {
      id: `mock-post-${Date.now()}`,
      authorId,
      authorName: 'You',
      title: input.title.trim(),
      description: input.description.trim(),
      venueId: input.venueId,
      venueName: input.venueName,
      startsAt: input.startsAt,
      expiresAt: input.expiresAt,
      vacancies: input.vacancies,
      joinedCount: 0,
      spotsLeft: input.vacancies,
      costCents: input.costCents,
      tags: input.tags,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    mockPosts.unshift(created);
    return created;
  }
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from('posts')
    .insert(toDbNewPost(authorId, input))
    .select('*, author:profiles!posts_author_id_fkey(display_name)')
    .single();
  if (error) throw new Error(error.message);
  return toNeedPost({ ...(data as DbPost), approved_count: 0 });
}

export type PostPatch = Partial<
  Pick<
    NewPostInput,
    'title' | 'description' | 'venueId' | 'venueName' | 'startsAt' | 'expiresAt' | 'vacancies' | 'costCents' | 'tags'
  >
>;

/**
 * Host edit. Server rules (guard_post_edit trigger): author only, open posts
 * only, vacancies never below approved count, starts_at stays future.
 */
export async function updatePost(postId: string, patch: PostPatch): Promise<NeedPost> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) dbPatch.title = patch.title.trim();
  if (patch.description !== undefined) dbPatch.description = patch.description.trim();
  if (patch.venueId !== undefined) dbPatch.venue_id = patch.venueId ?? null;
  if (patch.venueName !== undefined) dbPatch.venue_name = patch.venueName ?? null;
  if (patch.startsAt !== undefined) dbPatch.starts_at = patch.startsAt;
  if (patch.expiresAt !== undefined) dbPatch.expires_at = patch.expiresAt ?? null;
  if (patch.vacancies !== undefined) dbPatch.vacancies = patch.vacancies;
  if (patch.costCents !== undefined) dbPatch.cost_cents = patch.costCents ?? null;
  if (patch.tags !== undefined) dbPatch.tags = patch.tags;

  if (useMock()) {
    const i = mockPosts.findIndex((p) => p.id === postId);
    if (i < 0) throw new Error('Post not found.');
    const p = mockPosts[i];
    const next: NeedPost = {
      ...p,
      title: (patch.title ?? p.title).trim(),
      description: (patch.description ?? p.description).trim(),
      venueId: patch.venueId ?? p.venueId,
      venueName: patch.venueName ?? p.venueName,
      startsAt: patch.startsAt ?? p.startsAt,
      expiresAt: patch.expiresAt ?? p.expiresAt,
      vacancies: patch.vacancies ?? p.vacancies,
      costCents: patch.costCents ?? p.costCents,
      tags: patch.tags ?? p.tags,
    };
    if (next.vacancies < next.joinedCount)
      throw new Error(`Vacancies cannot be below the ${next.joinedCount} approved join(s).`);
    next.spotsLeft = Math.max(0, next.vacancies - next.joinedCount);
    mockPosts[i] = next;
    return next;
  }
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from('posts')
    .update(dbPatch)
    .eq('id', postId)
    .select('*, author:profiles!posts_author_id_fkey(display_name)')
    .single();
  if (error) throw new Error(error.message);
  const updated = await getPost(postId);
  return updated ?? toNeedPost({ ...(data as DbPost), approved_count: 0 });
}

/** Host cancellation. Terminal — a cancelled post cannot be reopened. */
export async function cancelPost(postId: string): Promise<void> {
  if (useMock()) {
    const p = mockPosts.find((x) => x.id === postId);
    if (!p) throw new Error('Post not found.');
    p.status = 'cancelled';
    return;
  }
  const supabase = getSupabase()!;
  const { error } = await supabase.rpc('cancel_post', { p_post_id: postId });
  if (error) throw new Error(error.message);
}

/**
 * Realtime subscription for a post list or single post. Returns unsubscribe.
 * No-op in demo mode.
 */
export function subscribeToPosts(onChange: () => void): () => void {
  if (useMock()) return () => {};
  const supabase = getSupabase()!;
  const ch = supabase
    .channel('posts-feed')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'join_requests' }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(ch);
  };
}
