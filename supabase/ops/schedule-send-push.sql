-- Sends queued push notifications every minute.
-- ONLY for a fresh project with no push scheduler. The current Nearry project
-- already has one (docs/play-test-release.md); running this too would
-- duplicate it.
-- Run ONCE in the Supabase SQL editor. This is not a migration: it needs the
-- hosted pg_cron, pg_net and Vault features, and your own secret.
--
-- Before running:
--   1. Database → Extensions: turn on pg_cron and pg_net.
--   2. Edge Functions → Secrets: PUSH_DISPATCH_SECRET is set, and send-push is
--      deployed (supabase functions deploy send-push --no-verify-jwt).
--   3. Put the SAME secret in Vault (replace the placeholder, run once):
--        select vault.create_secret('PASTE-THE-SAME-SECRET', 'push_dispatch_secret');
--
-- Safe to run again: it replaces its own schedule.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'nearry-send-push';

select cron.schedule(
  'nearry-send-push',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://ggeejgykahzquynwighw.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dispatch-secret',
      (select decrypted_secret from vault.decrypted_secrets
        where name = 'push_dispatch_secret' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  )
  -- Only when a push is waiting or a receipt is due (migration 00065).
  where public.push_work_due();
  $$
);

-- Check it is running (a row each minute, status 200 in the second query):
--   select status, return_message, start_time from cron.job_run_details
--     order by start_time desc limit 5;
--   select status_code, content, created from net._http_response
--     order by created desc limit 5;
-- 401 means the Vault secret and PUSH_DISPATCH_SECRET differ.
