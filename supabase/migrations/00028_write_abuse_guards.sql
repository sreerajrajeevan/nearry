-- 00028: Bound account-driven write amplification at the database boundary.
-- This protects cost, notifications and moderation queues even from modified clients.
-- Anonymous signup OTP limits remain a Supabase Auth/project setting.
begin;

create table public.app_write_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  scope text not null check (scope in ('post_hour','post_day','offer_hour','offer_day',
                                      'message_minute','message_day',
                                      'join_minute','join_day')),
  window_start timestamptz not null,
  writes integer not null default 0 check (writes >= 0),
  primary key (user_id,scope,window_start)
);
alter table public.app_write_usage enable row level security;
revoke all on public.app_write_usage from public,anon,authenticated;
grant all on public.app_write_usage to service_role;

create or replace function public.enforce_nearry_write_quota() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_small_scope text;
  v_large_scope text;
  v_small_limit integer;
  v_large_limit integer;
  v_small_window timestamptz;
  v_large_window timestamptz;
  v_now timestamptz := clock_timestamp();
  v_hit integer;
  v_idx integer;
begin
  -- Trusted maintenance and migrations normally have no end-user JWT.
  if v_actor is null then return new; end if;

  if tg_table_name='posts' then
    v_owner:=new.author_id;
    v_small_scope:='post_hour';v_large_scope:='post_day';
    v_small_limit:=8;v_large_limit:=30;
    v_small_window:=date_trunc('hour',v_now at time zone 'UTC') at time zone 'UTC';
  elsif tg_table_name='offers' then
    v_owner:=new.business_id;
    v_small_scope:='offer_hour';v_large_scope:='offer_day';
    v_small_limit:=10;v_large_limit:=40;
    v_small_window:=date_trunc('hour',v_now at time zone 'UTC') at time zone 'UTC';
  elsif tg_table_name='messages' then
    v_owner:=new.sender_id;
    v_small_scope:='message_minute';v_large_scope:='message_day';
    v_small_limit:=40;v_large_limit:=1000;
    v_small_window:=date_trunc('minute',v_now at time zone 'UTC') at time zone 'UTC';
  elsif tg_table_name='join_requests' then
    v_owner:=new.requester_id;
    v_small_scope:='join_minute';v_large_scope:='join_day';
    v_small_limit:=20;v_large_limit:=120;
    v_small_window:=date_trunc('minute',v_now at time zone 'UTC') at time zone 'UTC';
  else
    raise exception 'unsupported rate-limited operation';
  end if;

  -- Do not let a forged owner ID consume somebody else's quota.
  if v_owner is distinct from v_actor or not public.account_active(v_actor) then
    raise exception 'unauthorized write';
  end if;
  v_large_window:=date_trunc('day',v_now at time zone 'UTC') at time zone 'UTC';

  -- Each UPSERT is an atomic limit-and-increment, across app instances.
  -- A rejected second bucket rolls back the first increment as well.
  for v_idx in 1..2 loop
    v_hit:=null;
    insert into public.app_write_usage as quota(user_id,scope,window_start,writes)
      values(v_actor,
        case when v_idx=1 then v_small_scope else v_large_scope end,
        case when v_idx=1 then v_small_window else v_large_window end,1)
    on conflict(user_id,scope,window_start) do update
      set writes=quota.writes+1
      where quota.writes <
        case when v_idx=1 then v_small_limit else v_large_limit end
      returning writes into v_hit;

    if v_hit is null then
      raise exception 'Too many actions. Please try again later.'
        using errcode='P0001';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.enforce_nearry_write_quota()
  from public,anon,authenticated;

create trigger nearry_write_quota_posts
  before insert on public.posts for each row
  execute function public.enforce_nearry_write_quota();
create trigger nearry_write_quota_messages
  before insert on public.messages for each row
  execute function public.enforce_nearry_write_quota();
create trigger nearry_write_quota_offers
  before insert on public.offers for each row
  execute function public.enforce_nearry_write_quota();
create trigger nearry_write_quota_joins
  before insert on public.join_requests for each row
  execute function public.enforce_nearry_write_quota();

-- Existing service-only maintenance worker already invokes this function.
-- Preserve its existing cleanup behavior; add retention for quota counters.
create or replace function public.maintenance_retention_cleanup() returns void as $$
begin
  delete from public.content_reports where reviewed_at < now()-interval '90 days';
  delete from public.push_deliveries where created_at < now()-interval '30 days';
  delete from public.push_jobs where notification_id in
    (select id from public.notifications where created_at < now()-interval '30 days');
  delete from public.app_write_usage where window_start < now()-interval '2 days';
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.maintenance_retention_cleanup()
  from public,anon,authenticated;
grant execute on function public.maintenance_retention_cleanup() to service_role;
commit;
