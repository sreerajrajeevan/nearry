begin;
-- Push notifications stopped on 23 Nov 2026: claim_push_jobs (00050) returned a
-- WITH ... UPDATE from inside a subquery, which Postgres rejects, so every
-- send-push run failed and no push was delivered. This rewrites it as a
-- top-level statement. Pushes for notifications more than 12 hours old are
-- closed without sending (the in-app notification stays), so people don't get
-- days-old alerts once delivery resumes.
--
-- Also: push_work_due() lets the every-minute dispatcher skip calling the
-- send-push worker when nothing is waiting (see supabase/ops), and the daily
-- cleanup keeps 2 days of pg_cron history instead of 7.
create or replace function public.claim_push_jobs() returns jsonb as $$
declare result jsonb;
begin
 update push_jobs j set sent_at=now(),last_error='too old to push'
 from notifications n
 where n.id=j.notification_id and j.sent_at is null and n.created_at<now()-interval '12 hours';

 update push_jobs j set sent_at=now(),last_error='coalesced chat preview'
 where j.id in (
  select old.id from push_jobs old join notifications n on n.id=old.notification_id
  where old.sent_at is null and (old.attempts=0 or old.next_attempt_at<=now()) and n.thread_key is not null
  and exists(select 1 from notifications m
    where m.user_id=n.user_id and m.kind=n.kind and m.thread_key=n.thread_key and (m.created_at,m.id)>(n.created_at,n.id))
  order by old.next_attempt_at limit 500
 );

 with jobs as(
  select j.id from push_jobs j join notifications n on n.id=j.notification_id join profiles p on p.id=n.user_id
  where j.sent_at is null and j.attempts<5 and j.next_attempt_at<=now() and p.push_enabled
  and notification_allowed(n.user_id,n.kind,n.ref_id)
  and (n.thread_key is null or not exists(select 1 from notifications m where m.user_id=n.user_id and m.kind=n.kind and m.thread_key=n.thread_key and (m.created_at,m.id)>(n.created_at,n.id)))
  order by case when n.kind in ('message','plan_group_message') then 1 else 0 end,j.next_attempt_at,j.id
  for update of j skip locked limit 25
 ),claimed as (
  update push_jobs j set attempts=j.attempts+1,next_attempt_at=now()+interval '2 minutes' from jobs where jobs.id=j.id returning j.id,j.notification_id
 ) select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'notification_id',n.id,'user_id',n.user_id,'kind',n.kind,'ref_id',n.ref_id,'thread_key',n.thread_key,'title',n.title,'body',n.body)),'[]')
 into result
 from claimed c join notifications n on n.id=c.notification_id;
 return result;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.claim_push_jobs() from public,anon,authenticated;
grant execute on function public.claim_push_jobs() to service_role;

-- True when send-push has something to do: a push waiting to go out, or a
-- delivery receipt to check. Cheap enough to run every minute.
create function public.push_work_due() returns boolean as $$
 select exists(select 1 from push_jobs where sent_at is null and attempts<5 and (attempts=0 or next_attempt_at<=now()))
  or exists(select 1 from push_deliveries where status='ticket' and next_check_at<=now())
$$ language sql stable security definer set search_path=public,pg_temp;
revoke all on function public.push_work_due() from public,anon,authenticated;
grant execute on function public.push_work_due() to service_role;

create or replace function public.daily_cleanup() returns jsonb as $$
declare
 photos int;
 orphans int;
 notices int;
 cron_rows int = 0;
begin
 -- Photos of plans that started more than 7 days ago (finished or cancelled).
 -- Removing the rows queues the stored files (and thumbnails) for the
 -- storage worker through queue_removed_public_photo; the plan itself stays.
 with gone as (
  delete from post_photos ph using posts p
  where p.id = ph.post_id and p.starts_at < now() - interval '7 days'
  returning ph.id
 ) select count(*) into photos from gone;

 -- Stored plan/offer photos that nothing points to any more (old orphans,
 -- abandoned uploads). Two days' grace covers uploads still being attached;
 -- a thumbnail is kept while its full-size photo is in use. The storage worker
 -- deletes the files; a photo reattached before then is kept.
 with queued as (
  insert into media_cleanup_jobs(bucket,path,next_attempt_at)
  select 'photos', o.name, now() from storage.objects o
  where o.bucket_id = 'photos' and o.created_at < now() - interval '2 days'
   and not public_photo_referenced(o.name)
   and not public_photo_referenced(regexp_replace(o.name, '-thumb\.jpg$', '-full.jpg'))
  on conflict (path) do nothing
  returning 1
 ) select count(*) into orphans from queued;

 -- Notifications older than 90 days.
 with gone as (
  delete from notifications where created_at < now() - interval '90 days' returning id
 ) select count(*) into notices from gone;

 -- pg_cron keeps a row for every run (about 3,500 a day); keep two days.
 if to_regclass('cron.job_run_details') is not null then
  execute 'with gone as (delete from cron.job_run_details where start_time < now() - interval ''2 days'' returning 1) select count(*) from gone'
   into cron_rows;
 end if;

 return jsonb_build_object('planPhotos', photos, 'unusedFiles', orphans, 'notifications', notices, 'cronHistory', cron_rows);
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.daily_cleanup() from public,anon,authenticated;
revoke all on function public.daily_cleanup() from public,anon,authenticated;
grant execute on function public.daily_cleanup() to service_role;
commit;
