-- Read-only operational checks. No user data, worker credentials or raw commands.
select jobid,jobname,schedule,active from cron.job order by jobname;
select jobid,status,start_time,end_time from cron.job_run_details order by start_time desc limit 30;
select status_code,count(*) from net._http_response where created>now()-interval '1 day' group by status_code;
select count(*) filter(where sent_at is null and attempts<5) pending,
 count(*) filter(where sent_at is null and attempts>=5) exhausted,
 min(created_at) filter(where sent_at is null and attempts<5) oldest_pending from public.push_jobs;
select count(*) pending,count(*) filter(where attempts>=20) exhausted,min(requested_at) oldest_request from public.account_deletion_jobs;
select count(*) pending,count(*) filter(where attempts>=20) exhausted from public.media_cleanup_jobs;
select count(*) overdue_plans from public.posts where status='open' and (starts_at<=now() or expires_at<=now());
select count(*) overdue_holds from public.bookings where status='pending' and hold_expires_at<=now();
-- Confirm all five jobs exist and are active; recent executions succeed; HTTP
-- workers return 200 (401 = secret mismatch, 5xx = worker failure).
-- A queue whose oldest item keeps aging needs investigation. Do not blindly
-- reset attempt counters: inspect/retry the failed operation deliberately.
