-- Migration 00022 — let users delete their own notifications.
-- Run once in the Supabase dashboard SQL editor.
begin;

drop policy if exists "users delete own notifications" on public.notifications;
create policy "users delete own notifications" on public.notifications
  for delete using (auth.uid() = user_id);

commit;
