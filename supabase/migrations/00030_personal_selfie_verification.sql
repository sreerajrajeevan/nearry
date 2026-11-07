-- 00030: optional human photo comparison, private files and versioned admin review.
begin;
create table public.personal_selfie_reviews (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 submission_id uuid not null unique default gen_random_uuid(),
 selfie_path text,
 avatar_url_at_submission text,
 avatar_path text,
 status text not null default 'pending' check(status in ('unverified','pending','verified','rejected')),
 note text,
 consented_at timestamptz not null default now(),
 submitted_at timestamptz not null default now(),
 reviewed_at timestamptz,
 attempt_day date not null default current_date,
 attempts_today int not null default 1,
 check(status <> 'pending' or selfie_path is not null)
);
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check(kind in (
 'join_request','request_approved','request_declined','request_full','post_cancelled',
 'booking','booking_confirmed','booking_cancelled','message',
 'verification_approved','verification_rejected','selfie_review'
));
create index personal_selfie_pending on personal_selfie_reviews(submitted_at,user_id) where status='pending';
alter table public.personal_selfie_reviews enable row level security;
revoke all on public.personal_selfie_reviews from public,anon,authenticated;
grant select(user_id,submission_id,status,note,submitted_at,reviewed_at) on public.personal_selfie_reviews to authenticated;
grant all on public.personal_selfie_reviews to service_role;
create policy "owners read selfie status" on public.personal_selfie_reviews for select to authenticated using(user_id=auth.uid());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('selfie_proofs','selfie_proofs',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create function public.selfie_upload_allowed(p_path text) returns boolean as $$
 select coalesce(
  public.personal_profile_ready(auth.uid())
  and p_path ~ ('^'||auth.uid()::text||'/selfie-[A-Za-z0-9-]+[.](jpg|jpeg|png|webp)$')
  and not exists(select 1 from public.personal_selfie_reviews where user_id=auth.uid() and status in ('pending','verified'))
  and (select count(*) from storage.objects where bucket_id='selfie_proofs' and split_part(name,'/',1)=auth.uid()::text)<2,
 false);
$$ language sql stable security definer set search_path=public,pg_temp;
revoke all on function public.selfie_upload_allowed(text) from public,anon;
grant execute on function public.selfie_upload_allowed(text) to authenticated;
create function public.my_selfie_file_pending(p_path text) returns boolean as $$
 select exists(select 1 from personal_selfie_reviews where user_id=auth.uid() and selfie_path=p_path and status='pending');
$$ language sql stable security definer set search_path=public,pg_temp;
revoke all on function public.my_selfie_file_pending(text) from public,anon;
grant execute on function public.my_selfie_file_pending(text) to authenticated;
create policy "owners upload private selfies" on storage.objects for insert to authenticated
 with check(bucket_id='selfie_proofs' and public.selfie_upload_allowed(name));
create policy "owners read private selfies" on storage.objects for select to authenticated
 using(bucket_id='selfie_proofs' and split_part(name,'/',1)=auth.uid()::text and account_active(auth.uid()));
create policy "owners delete unused private selfies" on storage.objects for delete to authenticated
 using(bucket_id='selfie_proofs' and split_part(name,'/',1)=auth.uid()::text and not public.my_selfie_file_pending(name));
-- A comparison must stay bound to immutable image bytes. New app avatar uploads
-- use unique immutable paths. Legacy avatar.jpg uploads stay compatible with
-- old app versions, but cannot be submitted for comparison.
create policy "comparison images cannot be overwritten" on storage.objects as restrictive for update to authenticated
 using(bucket_id<>'selfie_proofs' and (bucket_id<>'avatars' or name !~ '/avatar-[0-9a-f-]{36}[.]jpg$'))
 with check(bucket_id<>'selfie_proofs' and (bucket_id<>'avatars' or name !~ '/avatar-[0-9a-f-]{36}[.]jpg$'));
-- Also prevent delete-and-reinsert at the same avatar path from changing the
-- bytes under an existing pending/approved comparison.
create function public.my_avatar_in_comparison(p_path text) returns boolean as $$
 select exists(select 1 from personal_selfie_reviews where user_id=auth.uid() and avatar_path=p_path and status in ('pending','verified'));
$$ language sql stable security definer set search_path=public,pg_temp;
revoke all on function public.my_avatar_in_comparison(text) from public,anon;
grant execute on function public.my_avatar_in_comparison(text) to authenticated;
create policy "comparison avatar cannot be deleted" on storage.objects as restrictive for delete to authenticated
 using(bucket_id<>'avatars' or not public.my_avatar_in_comparison(name));

alter table public.media_cleanup_jobs drop constraint if exists media_cleanup_jobs_bucket_check;
alter table public.media_cleanup_jobs add constraint media_cleanup_jobs_bucket_check check(bucket in ('photos','avatars','selfie_proofs'));

create function public.submit_personal_selfie(p_path text,p_consent boolean) returns void as $$
declare p profiles; r personal_selfie_reviews; image_path text; day_utc date:=(now() at time zone 'UTC')::date;
begin
 if p_consent is distinct from true or auth.uid() is null or not personal_profile_ready(auth.uid()) then
  raise exception 'Complete your profile and agree to the private selfie review first';end if;
 select * into p from profiles where id=auth.uid() for update;
 image_path:=split_part(split_part(p.avatar_url,'/storage/v1/object/public/avatars/',2),'?',1);
 if nullif(image_path,'') is null or image_path !~ ('^'||p.id::text||'/avatar-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]jpg$')
  or not exists(select 1 from storage.objects where bucket_id='avatars' and name=image_path)
  or exists(select 1 from media_cleanup_jobs where bucket='avatars' and path=image_path) then
  raise exception 'Upload a clear profile photo in Nearry before selfie review';end if;
 select * into r from personal_selfie_reviews where user_id=p.id for update;
 if r.status in ('pending','verified') then raise exception 'Your selfie is already pending or checked';end if;
 if r.submitted_at>now()-interval '2 minutes' then raise exception 'Please try again in two minutes';end if;
 if r.attempt_day=day_utc and r.attempts_today>=5 then raise exception 'You can submit up to five selfies per day';end if;
 if p_path is null or p_path !~ ('^'||p.id::text||'/selfie-[A-Za-z0-9-]+[.](jpg|jpeg|png|webp)$')
  or not exists(select 1 from storage.objects where bucket_id='selfie_proofs' and name=p_path)
  or exists(select 1 from media_cleanup_jobs where bucket='selfie_proofs' and path=p_path) then
  raise exception 'Missing or invalid private selfie upload';end if;
 insert into personal_selfie_reviews(user_id,submission_id,selfie_path,avatar_url_at_submission,avatar_path,status,note,consented_at,submitted_at,reviewed_at,attempt_day,attempts_today)
 values(p.id,gen_random_uuid(),p_path,p.avatar_url,image_path,'pending',null,now(),now(),null,day_utc,
   case when r.attempt_day=day_utc then r.attempts_today+1 else 1 end)
 on conflict(user_id) do update set submission_id=excluded.submission_id,selfie_path=excluded.selfie_path,
  avatar_url_at_submission=excluded.avatar_url_at_submission,avatar_path=excluded.avatar_path,status='pending',note=null,
  consented_at=now(),submitted_at=now(),reviewed_at=null,attempt_day=excluded.attempt_day,attempts_today=excluded.attempts_today;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.submit_personal_selfie(text,boolean) from public,anon;
grant execute on function public.submit_personal_selfie(text,boolean) to authenticated;

create function public.review_personal_selfie(p_user uuid,p_submission uuid,p_decision text,p_note text default '') returns void as $$
declare p profiles; r personal_selfie_reviews;
begin
 if p_decision is null or p_decision not in ('verified','rejected') or char_length(coalesce(p_note,''))>200 then raise exception 'Invalid selfie decision';end if;
 if p_decision='rejected' and nullif(btrim(p_note),'') is null then raise exception 'Review reason required';end if;
 -- All avatar/submit/review paths lock profile first, then review.
 select * into p from profiles where id=p_user for update;
 select * into r from personal_selfie_reviews where user_id=p_user for update;
 if r.status is distinct from 'pending' or r.submission_id is distinct from p_submission
  or r.selfie_path is null or r.submitted_at<=now()-interval '7 days'
  or p.avatar_url is distinct from r.avatar_url_at_submission then raise exception 'Review unavailable, expired or changed; refresh the queue';end if;
 if not account_active(p_user) or p.account_type<>'personal' then raise exception 'Review unavailable for an inactive account';end if;
 if p_decision='verified' and (not exists(select 1 from storage.objects where bucket_id='selfie_proofs' and name=r.selfie_path)
  or not exists(select 1 from storage.objects where bucket_id='avatars' and name=r.avatar_path)) then raise exception 'Review unavailable: comparison photo is missing';end if;
 update personal_selfie_reviews set selfie_path=null,status=p_decision,note=case when p_decision='rejected' then btrim(p_note) else null end,reviewed_at=now() where user_id=p_user;
 insert into media_cleanup_jobs(bucket,path)values('selfie_proofs',r.selfie_path) on conflict(path) do nothing;
 insert into notifications(user_id,kind,title,body)values(p_user,'selfie_review',case when p_decision='verified' then 'Your selfie check is complete' else 'Your selfie needs another try' end,
  case when p_decision='verified' then 'A reviewer compared your selfie with your profile photo.' else btrim(p_note) end);
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.review_personal_selfie(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.review_personal_selfie(uuid,uuid,text,text) to service_role;

create function public.withdraw_personal_selfie() returns void as $$
declare r personal_selfie_reviews;
begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 perform 1 from profiles where id=auth.uid() for update;
 select * into r from personal_selfie_reviews where user_id=auth.uid() for update;
 if found then
  update personal_selfie_reviews set status='unverified',selfie_path=null,avatar_url_at_submission=null,avatar_path=null,note=null,reviewed_at=now() where user_id=auth.uid();
  if r.selfie_path is not null then insert into media_cleanup_jobs(bucket,path)values('selfie_proofs',r.selfie_path) on conflict(path) do nothing;end if;
 end if;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.withdraw_personal_selfie() from public,anon;
grant execute on function public.withdraw_personal_selfie() to authenticated;

create function public.invalidate_selfie_on_avatar_change() returns trigger as $$
declare r personal_selfie_reviews; old_path text; new_path text;
begin
 select * into r from personal_selfie_reviews where user_id=new.id for update;
 if found then
  update personal_selfie_reviews set status='unverified',selfie_path=null,avatar_url_at_submission=null,avatar_path=null,
   note='Profile photo changed. You can submit a new selfie.',reviewed_at=now() where user_id=new.id;
  if r.selfie_path is not null then insert into media_cleanup_jobs(bucket,path)values('selfie_proofs',r.selfie_path) on conflict(path) do nothing;end if;
 end if;
 old_path:=split_part(split_part(old.avatar_url,'/storage/v1/object/public/avatars/',2),'?',1);
 new_path:=split_part(split_part(new.avatar_url,'/storage/v1/object/public/avatars/',2),'?',1);
 if nullif(old_path,'') is not null and split_part(old_path,'/',1)=new.id::text and old_path is distinct from new_path then
  insert into media_cleanup_jobs(bucket,path)values('avatars',old_path) on conflict(path) do nothing;
 end if;
 return new;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.invalidate_selfie_on_avatar_change() from public,anon,authenticated;
create trigger invalidate_selfie_when_avatar_changes after update of avatar_url on profiles for each row
 when(old.avatar_url is distinct from new.avatar_url) execute function public.invalidate_selfie_on_avatar_change();

create function public.is_personal_selfie_checked(p_user uuid) returns boolean as $$
 select exists(select 1 from personal_selfie_reviews r join profiles p on p.id=r.user_id
  join storage.objects o on o.bucket_id='avatars' and o.name=r.avatar_path
  where r.user_id=p_user and r.status='verified' and p.account_type='personal' and p.avatar_url=r.avatar_url_at_submission and account_active(p_user));
$$ language sql stable security definer set search_path=public,pg_temp;
revoke all on function public.is_personal_selfie_checked(uuid) from public,anon;
grant execute on function public.is_personal_selfie_checked(uuid) to authenticated;

create function public.admin_console_selfie_queue(p_offset int default 0,p_limit int default 26)
returns table(id uuid,user_id uuid,display_name text,submitted_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select r.submission_id,r.user_id,p.display_name,r.submitted_at from personal_selfie_reviews r join profiles p on p.id=r.user_id
 where r.status='pending' and r.submitted_at>now()-interval '7 days' and r.avatar_url_at_submission=p.avatar_url and account_active(p.id)
 order by r.submitted_at,r.user_id limit least(greatest(p_limit,1),100) offset least(greatest(p_offset,0),5000);
$$;
revoke all on function public.admin_console_selfie_queue(int,int) from public,anon,authenticated;
grant execute on function public.admin_console_selfie_queue(int,int) to service_role;

-- Reuse existing business/report logic without changing its authorization or audit.
alter function public.admin_console_decide(uuid,text,uuid,text,text) rename to admin_console_decide_before_selfie;
create function public.admin_console_decide(p_actor uuid,p_kind text,p_record_id uuid,p_decision text,p_note text default '') returns void as $$
declare v_user uuid;
begin
 if p_kind is distinct from 'selfie' then perform admin_console_decide_before_selfie(p_actor,p_kind,p_record_id,p_decision,p_note);return;end if;
 perform 1 from admin_console_members where user_id=p_actor and revoked_at is null and account_active(p_actor) for update;
 if not found then raise exception 'Admin not authorized';end if;
 select user_id into v_user from personal_selfie_reviews where submission_id=p_record_id;
 if v_user is null then raise exception 'Review unavailable or changed';end if;
 perform review_personal_selfie(v_user,p_record_id,p_decision,p_note);
 insert into admin_console_audit(actor_id,action,target_id,note)values(p_actor,'selfie:'||p_decision,p_record_id,btrim(coalesce(p_note,'')));
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.admin_console_decide(uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_console_decide(uuid,text,uuid,text,text) to service_role;
alter function public.admin_console_overview() rename to admin_console_overview_before_selfie;
create function public.admin_console_overview() returns jsonb as $$
 select admin_console_overview_before_selfie() || jsonb_build_object('pendingSelfieReviews',
  (select count(*) from personal_selfie_reviews r join profiles p on p.id=r.user_id where r.status='pending'
   and r.submitted_at>now()-interval '7 days' and r.avatar_url_at_submission=p.avatar_url and account_active(p.id)));
$$ language sql stable security definer set search_path=public,pg_temp;
revoke all on function public.admin_console_overview() from public,anon,authenticated;
grant execute on function public.admin_console_overview() to service_role;

create function public.expire_private_selfies() returns void as $$
declare candidate uuid; r personal_selfie_reviews;
begin
 for candidate in select p.id from profiles p join personal_selfie_reviews pending on pending.user_id=p.id
  where pending.status='pending' and pending.submitted_at<=now()-interval '7 days' order by p.id limit 100 for update of p skip locked
 loop
  select * into r from personal_selfie_reviews where user_id=candidate for update;
  if r.status='pending' and r.submitted_at<=now()-interval '7 days' then
   update personal_selfie_reviews set status='rejected',selfie_path=null,note='Review expired. Please submit a new selfie.',reviewed_at=now() where user_id=candidate;
   insert into media_cleanup_jobs(bucket,path)values('selfie_proofs',r.selfie_path) on conflict(path) do nothing;
  end if;
 end loop;
 -- Remove abandoned uploads through Storage API via the existing cleanup queue.
 insert into media_cleanup_jobs(bucket,path)
 select 'selfie_proofs',o.name from storage.objects o where o.bucket_id='selfie_proofs' and o.created_at<=now()-interval '24 hours'
  and not exists(select 1 from personal_selfie_reviews pending where pending.status='pending' and pending.selfie_path=o.name)
 on conflict(path) do nothing;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.expire_private_selfies() from public,anon,authenticated;
grant execute on function public.expire_private_selfies() to service_role;
create or replace function public.maintenance_retention_cleanup() returns void as $$
begin
 delete from content_reports where reviewed_at<now()-interval '90 days';
 delete from push_deliveries where created_at<now()-interval '30 days';
 delete from push_jobs where notification_id in(select id from notifications where created_at<now()-interval '30 days');
 perform expire_private_selfies();
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
notify pgrst,'reload schema';
commit;
