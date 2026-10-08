import { getSupabase, isSupabaseConfigured } from './supabase';
import { mockPosts, NeedPost } from '../data/mock';

/**
 * Need-People posts service — milestone 2.
 * Later: create/list with vacancy counts; vacancy auto-close runs here
 * (server-side cron or edge function decrements and closes at 0).
 */
export type NewPost = {
  title: string;
  description: string;
  venueId?: string;
  startsAt: string;
  vacancies: number;
  tags: string[];
};

export async function listPosts(): Promise<NeedPost[]> {
  if (isSupabaseConfigured) {
    const supabase = getSupabase()!;
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'open')
      .order('starts_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as NeedPost[];
  }
  return mockPosts;
}

export async function createPost(authorId: string, post: NewPost): Promise<NeedPost> {
  if (isSupabaseConfigured) {
    const supabase = getSupabase()!;
    const { data, error } = await supabase
      .from('posts')
      .insert({ author_id: authorId, status: 'open', ...post })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as NeedPost;
  }
  const created: NeedPost = {
    id: `mock-post-${Date.now()}`,
    authorId,
    authorName: 'You',
    status: 'open',
    joinedCount: 0,
    createdAt: new Date().toISOString(),
    ...post,
  };
  mockPosts.unshift(created);
  return created;
}
