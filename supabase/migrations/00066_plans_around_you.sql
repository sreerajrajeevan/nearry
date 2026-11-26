-- Plans around you: a host can share an open plan that starts within the next
-- 2 hours with people in the same place, over Bluetooth. The phone broadcasts
-- random codes that change every 10 minutes; only this database can turn a
-- code back into a plan. People who look around never broadcast anything.
begin;

create table public.plan_beacons(
  post_id uuid primary key references public.posts(id) on delete cascade,
  host_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  stopped_at timestamptz
);
create index plan_beacons_host on public.plan_beacons(host_id);

create table public.plan_beacon_codes(
  code text primary key check (code ~ '^[0-9a-f]{16}$'),
  post_id uuid not null references public.plan_beacons(post_id) on delete cascade,
  valid_from timestamptz not null,
  valid_until timestamptz not null
);
create index plan_beacon_codes_post on public.plan_beacon_codes(post_id);
create index plan_beacon_codes_until on public.plan_beacon_codes(valid_until);

alter table public.plan_beacons enable row level security;
alter table public.plan_beacon_codes enable row level security;
revoke all on public.plan_beacons, public.plan_beacon_codes from public, anon, authenticated;
grant all on public.plan_beacons, public.plan_beacon_codes to service_role;

-- Start (or restart) sharing. Returns the codes for every 10-minute window
-- until sharing ends: 30 minutes after the start, and 2 hours at most.
create function public.start_plan_beacon(p_post_id uuid) returns jsonb as $$
declare p posts; v_ends timestamptz; v_from timestamptz; v_until timestamptz; v_code text; v_codes jsonb := '[]'::jsonb;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 if not account_active(auth.uid()) then raise exception 'account unavailable'; end if;
 select * into p from posts where id = p_post_id for update;
 if not found or p.author_id is distinct from auth.uid() then raise exception 'Only the host can share this plan'; end if;
 if p.status <> 'open' or coalesce(p.expires_at, 'infinity') <= now() then raise exception 'You can only share open plans'; end if;
 if p.starts_at > now() + interval '2 hours' or p.starts_at <= now() - interval '30 minutes' then
  raise exception 'You can share plans starting within 2 hours';
 end if;
 v_ends := least(p.starts_at + interval '30 minutes', now() + interval '2 hours');

 delete from plan_beacon_codes where valid_until < now() - interval '1 day';
 delete from plan_beacon_codes where post_id = p.id;
 insert into plan_beacons(post_id, host_id, started_at, ends_at, stopped_at)
 values (p.id, auth.uid(), now(), v_ends, null)
 on conflict (post_id) do update set started_at = excluded.started_at, ends_at = excluded.ends_at, stopped_at = null;

 v_from := now();
 while v_from < v_ends loop
  v_until := least(v_from + interval '10 minutes', v_ends);
  v_code := substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 16);
  insert into plan_beacon_codes(code, post_id, valid_from, valid_until) values (v_code, p.id, v_from, v_until);
  v_codes := v_codes || jsonb_build_object('code', v_code,
    'from_ms', floor(extract(epoch from v_from) * 1000)::bigint,
    'until_ms', floor(extract(epoch from v_until) * 1000)::bigint);
  v_from := v_until;
 end loop;
 return jsonb_build_object('ends_ms', floor(extract(epoch from v_ends) * 1000)::bigint, 'codes', v_codes);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create function public.stop_plan_beacon(p_post_id uuid) returns void as $$
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 if not exists(select 1 from posts where id = p_post_id and author_id = auth.uid()) then
  raise exception 'Only the host can stop sharing this plan';
 end if;
 update plan_beacons set stopped_at = now() where post_id = p_post_id and stopped_at is null;
 delete from plan_beacon_codes where post_id = p_post_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- For the host's plan page: is this plan being shared right now, and until when.
create function public.plan_beacon_status(p_post_id uuid) returns jsonb as $$
 select jsonb_build_object(
   'sharing', coalesce(bool_or(b.stopped_at is null and b.ends_at > now()), false),
   'ends_ms', max(floor(extract(epoch from b.ends_at) * 1000)::bigint))
 from plan_beacons b join posts p on p.id = b.post_id
 where b.post_id = p_post_id and p.author_id = auth.uid()
$$ language sql stable security definer set search_path = public, pg_temp;

-- Turn codes heard over Bluetooth into plans the viewer may see and join.
-- A code works from 1 minute before its window to 2 minutes after it.
create function public.resolve_plan_beacons(p_codes text[]) returns uuid[] as $$
declare me profiles; v_ids uuid[];
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 if coalesce(cardinality(p_codes), 0) > 64 then raise exception 'Too many codes'; end if;
 select * into me from profiles where id = auth.uid();
 if not found or me.account_type <> 'personal' or not account_active(me.id) then return '{}'; end if;
 select coalesce(array_agg(x.id order by x.starts_at, x.id), '{}') into v_ids from (
  select distinct p.id, p.starts_at
  from plan_beacon_codes c
  join plan_beacons b on b.post_id = c.post_id
  join posts p on p.id = b.post_id
  where c.code = any(select lower(btrim(x)) from unnest(p_codes) x)
    and now() between c.valid_from - interval '1 minute' and c.valid_until + interval '2 minutes'
    and b.stopped_at is null and b.ends_at > now() - interval '2 minutes'
    and p.status = 'open' and coalesce(p.expires_at, 'infinity') > now()
    and p.starts_at > now() - interval '30 minutes'
    and p.author_id <> me.id
    and account_active(p.author_id)
    and not users_blocked(p.author_id, me.id)
    and (p.gender_preference is null or p.gender_preference = 'any' or me.gender = p.gender_preference)
    and ((p.plan_details->>'ageMin' is null and p.plan_details->>'ageMax' is null)
      or me.age between coalesce((p.plan_details->>'ageMin')::int, 18) and coalesce((p.plan_details->>'ageMax')::int, 100))
 ) x;
 return v_ids;
end;
$$ language plpgsql stable security definer set search_path = public, pg_temp;

revoke all on function public.start_plan_beacon(uuid), public.stop_plan_beacon(uuid),
  public.plan_beacon_status(uuid), public.resolve_plan_beacons(text[]) from public, anon;
grant execute on function public.start_plan_beacon(uuid), public.stop_plan_beacon(uuid),
  public.plan_beacon_status(uuid), public.resolve_plan_beacons(text[]) to authenticated;

commit;
