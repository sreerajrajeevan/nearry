begin;
-- Daily cleanup to keep the database and photo storage small.
-- Scheduled once a day by supabase/ops/setup-maintenance.sql.
-- Applied live on 23 Nov 2026 (the unused-files step a few minutes after the rest).
create function public.daily_cleanup() returns jsonb as $$
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

 -- pg_cron keeps a row for every run (about 3,500 a day); keep one week.
 if to_regclass('cron.job_run_details') is not null then
  execute 'with gone as (delete from cron.job_run_details where start_time < now() - interval ''7 days'' returning 1) select count(*) from gone'
   into cron_rows;
 end if;

 return jsonb_build_object('planPhotos', photos, 'unusedFiles', orphans, 'notifications', notices, 'cronHistory', cron_rows);
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.daily_cleanup() from public,anon,authenticated;
grant execute on function public.daily_cleanup() to service_role;
commit;
