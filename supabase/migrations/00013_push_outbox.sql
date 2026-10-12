-- Push delivery is driven by committed notification events, never client text.
begin;
create table push_jobs(
 id uuid primary key default gen_random_uuid(),notification_id uuid not null unique references notifications(id) on delete cascade,
 attempts int not null default 0,next_attempt_at timestamptz not null default now(),sent_at timestamptz,last_error text
);
alter table push_jobs enable row level security;
revoke all on push_jobs from anon,authenticated;
grant all on push_jobs to service_role;
create or replace function queue_notification_push() returns trigger as $$
begin insert into push_jobs(notification_id) values(new.id) on conflict do nothing;return new;end;
$$ language plpgsql security definer set search_path=public;
create trigger trg_queue_notification_push after insert on notifications for each row execute function queue_notification_push();
-- Bounded claims with leases prevent repeated worker runs from sending the same job concurrently.
create or replace function claim_push_jobs() returns jsonb as $$
 with jobs as (select id from push_jobs where sent_at is null and attempts<5 and next_attempt_at<=now()
  order by next_attempt_at for update skip locked limit 50),claimed as (
 update push_jobs j set attempts=j.attempts+1,next_attempt_at=now()+interval '5 minutes' from jobs where jobs.id=j.id
 returning j.id,j.notification_id
 ) select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'user_id',n.user_id,'title',n.title,'body',n.body)),'[]'::jsonb)
 from claimed c join notifications n on n.id=c.notification_id;
$$ language sql security definer set search_path=public;
-- One Expo token belongs to the account currently using its installation.
-- Keep the newest registration if an old version registered it to several users.
delete from push_tokens a using push_tokens b where a.token=b.token and
 (a.updated_at,a.user_id)<(b.updated_at,b.user_id);
create unique index push_token_installation_unique on push_tokens(token);
revoke insert,update on push_tokens from anon,authenticated;
create or replace function register_push_token(p_token text,p_platform text) returns void as $$
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 if p_token is null or p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'
 or p_platform is null or p_platform not in ('ios','android') then raise exception 'invalid push token'; end if;
 insert into push_tokens(user_id,token,platform,updated_at) values(auth.uid(),p_token,p_platform,now())
 on conflict(token) do update set user_id=excluded.user_id,platform=excluded.platform,updated_at=now();
end;
$$ language plpgsql security definer set search_path=public;
revoke execute on function claim_push_jobs(),register_push_token(text,text) from public,anon,authenticated;
grant execute on function claim_push_jobs() to service_role;
grant execute on function register_push_token(text,text) to authenticated;
-- Realtime changes must be explicitly published in Supabase.
do $$ declare t text;begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach t in array array['posts','join_requests','offers','bookings','messages','notifications'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
    execute format('alter publication supabase_realtime add table public.%I',t);
   end if;
  end loop;
 end if;
end;$$;
commit;
