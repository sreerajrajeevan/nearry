-- OPERATOR-ONLY, after forward migrations and worker deployment. Not a migration.
-- Enable hosted pg_cron / pg_net first. Store these in Vault privately:
-- nearry_backend_url (https://<project>.supabase.co)
-- push_dispatch_secret = PUSH_DISPATCH_SECRET
-- account_maintenance_secret = ACCOUNT_MAINTENANCE_SECRET
-- verification_dispatch_secret = VERIFICATION_DISPATCH_SECRET
-- Never paste secrets into this file or commit them.
begin;
do $setup$
declare task record; command_text text; backend text; worker_secret text;
begin
 if to_regclass('cron.job') is null then raise exception 'Enable pg_cron before setup';end if;
 -- Preserve any existing equivalent schedule, even one with a different name.
 if not exists(select 1 from cron.job where command ilike '%close_expired_posts%') then
  perform cron.schedule('nearry-expire-plans','* * * * *','select public.close_expired_posts();');
 end if;
 if not exists(select 1 from cron.job where command ilike '%expire_booking_holds%') then
  perform cron.schedule('nearry-expire-holds','* * * * *','select public.expire_booking_holds();');
 end if;
 -- 3:00 am India time (21:30 UTC): plan photos, old notifications, cron history.
 if not exists(select 1 from cron.job where command ilike '%daily_cleanup%') then
  perform cron.schedule('nearry-daily-cleanup','30 21 * * *','select public.daily_cleanup();');
 end if;
 select decrypted_secret into backend from vault.decrypted_secrets where name='nearry_backend_url' limit 1;
 if backend is null or backend !~ '^https://[a-zA-Z0-9.-]+$' then raise exception 'Set a valid nearry_backend_url in Vault';end if;
 for task in select * from (values
  ('nearry-send-push','send-push','push_dispatch_secret','* * * * *'),
  ('nearry-account-maintenance','account-maintenance','account_maintenance_secret','*/5 * * * *'),
  ('nearry-notify-verification','notify-verification','verification_dispatch_secret','*/5 * * * *')
 )as tasks(name,endpoint,secret,schedule)
 loop
  if exists(select 1 from cron.job where jobname=task.name or command like '%/functions/v1/'||task.endpoint||'%') then continue;end if;
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then raise exception 'Enable pg_net before setup';end if;
  select decrypted_secret into worker_secret from vault.decrypted_secrets where name=task.secret limit 1;
  if worker_secret is null or length(worker_secret)<20 then raise exception 'Missing worker secret in Vault: %',task.secret;end if;
  -- Store the lookup, never a decrypted credential, in the scheduler command.
  command_text=format('select net.http_post(url := %L,headers := jsonb_build_object(''Content-Type'',''application/json'',''x-dispatch-secret'',(select decrypted_secret from vault.decrypted_secrets where name=%L limit 1)),body := ''{}''::jsonb,timeout_milliseconds := 45000);',backend||'/functions/v1/'||task.endpoint,task.secret);
  perform cron.schedule(task.name,task.schedule,command_text);
 end loop;
end;
$setup$;
commit;
-- Run verify-maintenance.sql next. Existing but inactive/broken jobs are
-- reported there; this setup deliberately does not overwrite or duplicate them.
