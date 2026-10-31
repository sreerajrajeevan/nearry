-- 00026: optional personal-account selfie review. A reviewer compares the
-- private camera image with the current public profile photo. This is NOT
-- legal identity, age, or automated liveness verification.
begin;

create table public.personal_selfie_reviews (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  selfie_path text,
  status text not null default 'pending'
    check (status in ('pending','verified','rejected')),
  note text,
  consented_at timestamptz not null default now(),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.personal_selfie_reviews enable row level security;
revoke all on public.personal_selfie_reviews from public, anon, authenticated;
grant select (user_id,status,note,submitted_at,reviewed_at)
  on public.personal_selfie_reviews to authenticated;
grant all on public.personal_selfie_reviews to service_role;
create policy "owners read selfie review status"
  on public.personal_selfie_reviews for select to authenticated
  using (user_id=auth.uid());

-- The image must never be stored in the public avatars/photos bucket.
insert into storage.buckets(id,name,public)
values ('selfie_proofs','selfie_proofs',false)
on conflict (id) do nothing;
create policy "owners upload private selfies" on storage.objects
  for insert to authenticated with check (
    bucket_id='selfie_proofs'
    and (storage.foldername(name))[1]=auth.uid()::text
    and name ~ ('^' || auth.uid()::text || '/selfie-[A-Za-z0-9-]+[.](jpg|jpeg|png|webp)$')
    and account_active(auth.uid())
  );
create policy "owners inspect private selfie uploads" on storage.objects
  for select to authenticated using (
    bucket_id='selfie_proofs'
    and (storage.foldername(name))[1]=auth.uid()::text
  );
create policy "owners delete unused private selfies" on storage.objects
  for delete to authenticated using (
    bucket_id='selfie_proofs'
    and (storage.foldername(name))[1]=auth.uid()::text
    and not exists (
      select 1 from public.personal_selfie_reviews r
      where r.user_id=auth.uid() and r.selfie_path=storage.objects.name
      and r.status='pending'
    )
  );

-- Existing account maintenance already processes media_cleanup_jobs using
-- Storage API. Extend its allowed buckets; do not delete Storage DB rows in SQL.
alter table public.media_cleanup_jobs
  drop constraint if exists media_cleanup_jobs_bucket_check;
alter table public.media_cleanup_jobs
  add constraint media_cleanup_jobs_bucket_check
  check(bucket in ('photos','selfie_proofs'));

create function public.submit_personal_selfie(p_path text,p_consent boolean)
returns void as $$
declare v_account_type text;v_avatar text;v_old_path text;
        v_status text;v_submitted timestamptz;
begin
  if auth.uid() is null or p_consent is distinct from true
     or not account_active(auth.uid()) then
    raise exception 'Sign in and agree to the private selfie review first';
  end if;
  select account_type,avatar_url into v_account_type,v_avatar
    from public.profiles where id=auth.uid() for update;
  if v_account_type is distinct from 'personal' then
    raise exception 'Selfie review is for personal accounts';
  end if;
  if nullif(trim(v_avatar),'') is null then
    raise exception 'Add a clear profile photo before selfie review';
  end if;
  if p_path is null or p_path !~
      ('^' || auth.uid()::text || '/selfie-[A-Za-z0-9-]+[.](jpg|jpeg|png|webp)$')
    or not exists (
      select 1 from storage.objects where bucket_id='selfie_proofs'
      and name=p_path
    ) then
    raise exception 'Missing or invalid private selfie upload';
  end if;
  select status,selfie_path,submitted_at into v_status,v_old_path,v_submitted
    from public.personal_selfie_reviews where user_id=auth.uid() for update;
  if v_status in ('pending','verified') then
    raise exception 'Your selfie is already pending or approved';
  end if;
  if v_submitted > now()-interval '2 minutes' then
    raise exception 'Please try again in a few minutes';
  end if;
  if v_old_path is not null and v_old_path<>p_path then
    insert into public.media_cleanup_jobs(bucket,path)
      values('selfie_proofs',v_old_path) on conflict(path) do nothing;
  end if;
  insert into public.personal_selfie_reviews
    (user_id,selfie_path,status,note,consented_at,submitted_at,reviewed_at)
    values(auth.uid(),p_path,'pending',null,now(),now(),null)
  on conflict(user_id) do update set
    selfie_path=excluded.selfie_path,status='pending',note=null,
    consented_at=now(),submitted_at=now(),reviewed_at=null;
end;
$$ language plpgsql security definer set search_path=public;
revoke all on function public.submit_personal_selfie(text,boolean)
  from public,anon,authenticated;
grant execute on function public.submit_personal_selfie(text,boolean)
  to authenticated;

-- Only the trusted service role can approve after HUMAN inspection.
create function public.review_personal_selfie(
  p_user uuid,p_decision text,p_note text default null
) returns void as $$
declare v_path text;v_status text;
begin
  if p_decision not in ('verified','rejected') then
    raise exception 'Decision must be verified or rejected';
  end if;
  select selfie_path,status into v_path,v_status
    from public.personal_selfie_reviews
    where user_id=p_user for update;
  if v_status is distinct from 'pending' or v_path is null then
    raise exception 'No pending selfie for this user';
  end if;
  if not exists(
    select 1 from storage.objects
    where bucket_id='selfie_proofs' and name=v_path
  ) then raise exception 'Private review photo is missing'; end if;
  if p_decision='verified' and
     (not account_active(p_user) or not exists(
       select 1 from profiles where id=p_user and account_type='personal'
       and nullif(trim(avatar_url),'') is not null
     )) then raise exception 'Account is no longer eligible'; end if;
  update public.personal_selfie_reviews
    set selfie_path=null,status=p_decision,
        note=case when p_decision='rejected'
          then coalesce(nullif(left(trim(p_note),300),''),'Photo did not pass review')
          else null end,
        reviewed_at=now()
    where user_id=p_user;
  insert into public.media_cleanup_jobs(bucket,path)
    values('selfie_proofs',v_path) on conflict(path) do nothing;
end;
$$ language plpgsql security definer set search_path=public;
revoke all on function public.review_personal_selfie(uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.review_personal_selfie(uuid,text,text)
  to service_role;

-- A profile photo change invalidates an earlier human comparison.
create function public.invalidate_selfie_on_avatar_change()
returns trigger as $$
declare v_path text;
begin
  select selfie_path into v_path from public.personal_selfie_reviews
    where user_id=new.id for update;
  if found then
    update public.personal_selfie_reviews
      set status='rejected',selfie_path=null,
          note='Profile photo changed. Submit a new selfie for review.',
          reviewed_at=now()
      where user_id=new.id;
    if v_path is not null then
      insert into public.media_cleanup_jobs(bucket,path)
        values('selfie_proofs',v_path) on conflict(path) do nothing;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path=public;
create trigger invalidate_selfie_when_avatar_changes
  after update of avatar_url on public.profiles
  for each row
  when (old.avatar_url is distinct from new.avatar_url)
  execute function public.invalidate_selfie_on_avatar_change();

-- The public interface exposes ONLY a boolean review result, never images or notes.
create function public.is_personal_selfie_checked(p_user uuid)
returns boolean as $$
  select coalesce(
    account_active(p_user) and exists(
      select 1 from public.personal_selfie_reviews r
      where r.user_id=p_user and r.status='verified'
    ),false
  );
$$ language sql stable security definer set search_path=public;
revoke all on function public.is_personal_selfie_checked(uuid)
  from public,anon,authenticated;
grant execute on function public.is_personal_selfie_checked(uuid)
  to authenticated;

commit;
