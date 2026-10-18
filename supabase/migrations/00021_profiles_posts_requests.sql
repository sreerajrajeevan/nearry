-- Migration 00021 — profile pictures, gender, request limits, slot-full status.
-- Run once in the Supabase dashboard SQL editor.
begin;

-- 1. Gender on profiles (personal accounts).
alter table public.profiles
  add column if not exists gender text check (gender in ('male', 'female', 'other'));
grant update (gender) on public.profiles to authenticated;

-- 2. Optional gender preference on posts.
alter table public.posts
  add column if not exists gender_preference text check (gender_preference in ('male', 'female', 'any'));
grant update (gender_preference) on public.posts to authenticated;

-- 3. Public avatars bucket.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars owner write" on storage.objects;
create policy "avatars owner write" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "avatars owner update" on storage.objects;
create policy "avatars owner update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "avatars owner delete" on storage.objects;
create policy "avatars owner delete" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 4. Decline counter for the 2-chance request limit.
alter table public.join_requests
  add column if not exists decline_count int not null default 0;

-- 5. New 'full' status: post filled before this request was handled.
alter table public.join_requests
  drop constraint if exists join_requests_status_check;
alter table public.join_requests
  add constraint join_requests_status_check
  check (status in ('pending', 'approved', 'declined', 'withdrawn', 'full'));

-- 6. Declining increments the counter.
create or replace function public.decline_join_request(p_request_id uuid)
returns void as $$
declare p posts; r join_requests; pid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select post_id into pid from join_requests where id=p_request_id;
  select * into p from posts where id=pid for update;
  if not found or p.author_id is distinct from auth.uid() then raise exception 'only the host can decline'; end if;
  select * into r from join_requests where id=p_request_id for update;
  if not found or r.status <> 'pending' then raise exception 'request is not pending'; end if;
  update join_requests
    set status='declined', decline_count = decline_count + 1
  where id=r.id;
end;
$$ language plpgsql security definer set search_path = public;

-- 7. Block re-requests after 2 declines.
create or replace function public.request_join(p_post_id uuid)
returns jsonb as $$
declare p posts; r join_requests;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from profiles where id = auth.uid() and account_type = 'personal' and onboarding_completed) then raise exception 'personal onboarding required'; end if;
  select * into p from posts where id = p_post_id for update;
  if not found or p.author_id = auth.uid() then raise exception 'post not found or cannot join your own post'; end if;
  if p.status <> 'open' or coalesce(p.expires_at,p.starts_at) <= now() or p.starts_at <= now() then raise exception 'post is closed or expired'; end if;
  if (select count(*) from join_requests where post_id=p.id and status='approved') >= p.vacancies then raise exception 'post is full'; end if;
  select * into r from join_requests where post_id=p.id and requester_id=auth.uid() for update;
  if found and r.status in ('pending','approved') then raise exception 'you already requested or joined this post'; end if;
  if found and r.decline_count >= 2 then raise exception 'no more requests allowed for this post'; end if;
  if r.id is null then
    insert into join_requests(post_id,requester_id,status) values(p.id,auth.uid(),'pending') returning * into r;
  else
    -- Re-request after a decline/withdrawal: fresh row (new id) so the host
    -- is notified again, carrying the decline count forward.
    delete from join_requests where id=r.id;
    insert into join_requests(post_id,requester_id,status,decline_count)
      values(p.id,auth.uid(),'pending',r.decline_count) returning * into r;
  end if;
  return to_jsonb(r);
end;
$$ language plpgsql security definer set search_path = public;

-- 8. When a post fills, remaining pendings become 'full' (not 'declined').
create or replace function public.approve_join_request(p_request_id uuid)
returns json as $$
declare p posts; r join_requests; pid uuid; taken int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select post_id into pid from join_requests where id=p_request_id;
  select * into p from posts where id=pid for update;
  if not found or p.author_id is distinct from auth.uid() then raise exception 'only the host can approve requests'; end if;
  select * into r from join_requests where id=p_request_id and post_id=p.id for update;
  if not found then raise exception 'join request not found'; end if;
  if r.status = 'full' then raise exception 'post is full'; end if;
  if r.status <> 'pending' then raise exception 'request is not pending'; end if;
  if r.requester_id=p.author_id then raise exception 'cannot join your own post'; end if;
  if p.status <> 'open' or coalesce(p.expires_at,p.starts_at)<=now() or p.starts_at<=now() then raise exception 'post is closed or expired'; end if;
  select count(*) into taken from join_requests where post_id=p.id and status='approved';
  if taken>=p.vacancies then raise exception 'post is full'; end if;
  update join_requests set status='approved' where id=r.id;
  if taken+1>=p.vacancies then
    update posts set status='closed' where id=p.id;
    update join_requests set status='full'
      where post_id=p.id and status='pending' and id<>r.id;
  end if;
  return json_build_object('spots_left',p.vacancies-taken-1,'post_closed',taken+1>=p.vacancies);
end;
$$ language plpgsql security definer set search_path = public;

-- 8b. When a post reopens, 'full' requests go back to 'pending'.
create or replace function public.reopen_post_if_space()
returns trigger as $$
declare p posts;
begin
  if old.status <> 'approved' then return coalesce(new,old); end if;
  if tg_op='UPDATE' and new.status='approved' then return new; end if;
  select * into p from posts where id=old.post_id for update;
  if p.status='closed' and coalesce(p.expires_at,p.starts_at)>now() and p.starts_at>now()
    and (select count(*) from join_requests where post_id=p.id and status='approved')<p.vacancies then
    update posts set status='open' where id=p.id;
    update join_requests set status='pending'
      where post_id=p.id and status='full';
  end if;
  return coalesce(new,old);
end;
$$ language plpgsql security definer set search_path = public;

-- 9. Notify on 'full' with slot-full copy (distinct from explicit declines).
-- Allow the new kind in the notifications check.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
 'join_request','request_approved','request_declined','request_full','post_cancelled',
 'booking','booking_confirmed','booking_cancelled','message',
 'verification_approved','verification_rejected'
));

create or replace function public.notify_join_request()
returns trigger as $$
declare v_kind text; v_user uuid; v_title text; v_body text;
begin
  if tg_op = 'INSERT' then
    v_kind := 'join_request';
    select p.author_id into v_user from posts p where p.id = new.post_id;
    select 'New join request',
           pr.display_name || ' wants to join "' || p.title || '"'
      into v_title, v_body
    from profiles pr, posts p
    where pr.id = new.requester_id and p.id = new.post_id;
  elsif tg_op = 'UPDATE' and new.status = 'approved' and old.status is distinct from 'approved' then
    v_kind := 'request_approved';
    v_user := new.requester_id;
    select 'Request approved', 'You''re in! "' || p.title || '"'
      into v_title, v_body from posts p where p.id = new.post_id;
  elsif tg_op = 'UPDATE' and new.status = 'declined' and old.status is distinct from 'declined' then
    v_kind := 'request_declined';
    v_user := new.requester_id;
    select 'Request declined', '"' || p.title || '" didn''t work out this time'
      into v_title, v_body from posts p where p.id = new.post_id;
  elsif tg_op = 'UPDATE' and new.status = 'full' and old.status is distinct from 'full' then
    v_kind := 'request_full';
    v_user := new.requester_id;
    select 'Slot full', '"' || p.title || '" filled up before your request was handled'
      into v_title, v_body from posts p where p.id = new.post_id;
  else
    return new;
  end if;

  insert into notifications (user_id, kind, title, body, ref_id)
  values (v_user, v_kind, v_title, v_body, new.post_id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

commit;
