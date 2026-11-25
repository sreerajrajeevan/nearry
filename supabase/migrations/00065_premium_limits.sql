-- 00065 — Nearry Premium: entitlements and daily plan / join limits.
-- premium_entitlements is written only by the service role (store webhook /
-- verify edge function); users read their own row. Free accounts get 3 plans
-- and 10 join requests per India day; Premium is unlimited but still counted.
-- daily_usage holds one row per (user, kind, day, ref): deleting a plan does
-- not give the slot back, and re-sending the same request is free.
begin;

create table public.premium_entitlements (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  product_id text,
  store text,
  updated_at timestamptz not null default now()
);
alter table public.premium_entitlements enable row level security;
create policy "premium read own" on public.premium_entitlements
  for select using (user_id = (select auth.uid()));
revoke all on public.premium_entitlements from public, anon, authenticated;
grant select on public.premium_entitlements to authenticated;
grant select, insert, update, delete on public.premium_entitlements to service_role;

create or replace function public.has_premium(p_user uuid) returns boolean as $$
  select exists(select 1 from public.premium_entitlements
    where user_id = p_user and expires_at > now());
$$ language sql stable security definer set search_path = public, pg_temp;
revoke execute on function public.has_premium(uuid) from public, anon, authenticated;
grant execute on function public.has_premium(uuid) to service_role;

create table public.daily_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('plan','join')),
  ref_id uuid not null,
  primary key (user_id, kind, day, ref_id)
);
alter table public.daily_usage enable row level security;
revoke all on public.daily_usage from public, anon, authenticated;
grant select, insert, update, delete on public.daily_usage to service_role;

create or replace function public.count_daily_usage(p_user uuid, p_kind text, p_ref uuid) returns void as $$
declare v_day date := (now() at time zone 'Asia/Kolkata')::date; v_limit int;
begin
  if auth.uid() is distinct from p_user then return; end if;
  -- Serialize per user and kind so parallel inserts cannot all pass the count.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_kind, 0));
  -- Re-sending a join request does not cost a new slot. Plans never get this
  -- shortcut: clients can pick the post id, so delete + re-insert must count.
  if p_kind = 'join' and exists(select 1 from public.daily_usage
    where user_id = p_user and kind = p_kind and day = v_day and ref_id = p_ref) then return; end if;
  v_limit := case p_kind when 'plan' then 3 else 10 end;
  if not public.has_premium(p_user)
    and (select count(*) from public.daily_usage where user_id = p_user and kind = p_kind and day = v_day) >= v_limit then
    raise exception '%', case p_kind when 'plan' then 'daily_plan_limit' else 'daily_join_limit' end;
  end if;
  insert into public.daily_usage(user_id, day, kind, ref_id) values(p_user, v_day, p_kind, p_ref);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
revoke execute on function public.count_daily_usage(uuid, text, uuid) from public, anon, authenticated;

create or replace function public.daily_plan_limit_trg() returns trigger as $$
begin
  perform public.count_daily_usage(new.author_id, 'plan', new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
revoke execute on function public.daily_plan_limit_trg() from public, anon, authenticated;
create trigger a_daily_plan_limit before insert on public.posts
  for each row execute function public.daily_plan_limit_trg();

create or replace function public.daily_join_limit_trg() returns trigger as $$
begin
  perform public.count_daily_usage(new.requester_id, 'join', new.post_id);
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
revoke execute on function public.daily_join_limit_trg() from public, anon, authenticated;
create trigger a_daily_join_limit before insert on public.join_requests
  for each row execute function public.daily_join_limit_trg();

notify pgrst, 'reload schema';
commit;
