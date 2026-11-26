-- 00067 — Nearry Premium: server-side "Hosted by" filter.
-- Gender is never readable across profiles; the filter runs only inside this
-- security-definer function, which returns host ids (open, upcoming plans
-- only, honouring blocks, suspended accounts and removed plans) and is
-- Premium-gated. discover_posts (00052) accepts an optional "hostGender"
-- filter key; without it results are unchanged, so older builds and the
-- nearby_post_cards wrapper keep working. Requires 00052 and 00066.
begin;

create function public.hosts_matching_gender(p_gender text) returns setof uuid as $$
begin
 if p_gender is null or p_gender not in ('female','male','other') then
  raise exception 'invalid host filter';
 end if;
 if not public.has_premium(auth.uid()) then
  raise exception 'premium_required';
 end if;
 return query
 select distinct p.author_id from public.posts p
 join public.profiles pr on pr.id=p.author_id
 where p.status='open' and p.starts_at>now() and (p.expires_at is null or p.expires_at>now())
  and pr.gender=p_gender
  and public.visible_author(p.author_id) and public.content_visible('post',p.id);
end;
$$ language plpgsql stable security definer set search_path = public, pg_temp;
revoke all on function public.hosts_matching_gender(text) from public, anon;
grant execute on function public.hosts_matching_gender(text) to authenticated;

-- Same body as 00052, plus the optional hostGender filter ($7).
create or replace function public.discover_posts(p_filters jsonb default '{}',p_cursor jsonb default null,p_limit int default 30) returns jsonb as $fn$
declare f jsonb:=coalesce(p_filters,'{}'); origin geography; radius double precision; lat double precision; lng double precision;
 lim int:=least(80,greatest(1,coalesce(p_limit,30))); sort text:=coalesce(f->>'sort','soonest'); ordering text; cursor_test text; result jsonb; hosts uuid[];
begin
 if not account_active(auth.uid()) then raise exception 'Account unavailable';end if;
 if jsonb_typeof(f)<>'object' or octet_length(f::text)>4000 or length(coalesce(f->>'search',''))>120
  or sort not in ('soonest','nearest','newest') or coalesce(f->>'status','open') not in ('open','all','closed','cancelled')
  or f->>'category' is not null and f->>'category' not in ('Play','Meet','Explore','Unwind')
  or f->>'audience' is not null and f->>'audience' not in ('all','any','male','female')
  or f->>'hostGender' is not null and f->>'hostGender' not in ('female','male','other') then raise exception 'Choose valid discovery filters';end if;
 -- Premium "Hosted by": raises premium_required for free users, even in an empty area.
 if f->>'hostGender' is not null then hosts:=array(select public.hosts_matching_gender(f->>'hostGender'));end if;
 lat=(f->>'latitude')::double precision;lng=(f->>'longitude')::double precision;
 if (lat is null)<>(lng is null) then raise exception 'Choose a valid search area';end if;
 if lat is not null then
  radius=coalesce((f->>'radiusM')::double precision,5000);
  if not(lat between -90 and 90 and lng between -180 and 180 and radius between 100 and 50000) then raise exception 'Choose a valid area and distance';end if;
  origin=st_setsrid(st_makepoint(lng,lat),4326)::geography;
 end if;
 if sort='nearest' and origin is null then sort='soonest';end if;
 ordering=case sort when 'nearest' then 'distance_m asc,p.starts_at asc,p.id asc'
  when 'newest' then 'p.created_at desc,p.starts_at asc,p.id asc' else 'p.starts_at asc,p.id asc' end;
 cursor_test=case sort when 'nearest' then '(loc.point <-> $4,p.starts_at,p.id)>(($2->>''distanceM'')::double precision,($2->>''at'')::timestamptz,($2->>''id'')::uuid)'
  when 'newest' then '(p.created_at<($2->>''at'')::timestamptz or p.created_at=($2->>''at'')::timestamptz and (p.starts_at,p.id)>(($2->>''startsAt'')::timestamptz,($2->>''id'')::uuid))'
  else '(p.starts_at,p.id)>(($2->>''at'')::timestamptz,($2->>''id'')::uuid)' end;
 execute '
 with candidates as materialized(
  select p.id,p.starts_at,p.created_at,case when $4 is not null then loc.point <-> $4 end distance_m
  from public.posts p left join public.post_locations loc on loc.post_id=p.id
  where (coalesce($1->>''status'',''open'')=''all'' or p.status=coalesce($1->>''status'',''open''))
   and (coalesce($1->>''status'',''open'')<>''open'' or p.starts_at>now() and (p.expires_at is null or p.expires_at>now()))
   and ($4 is null or st_dwithin(loc.point,$4,$5))
   and (not coalesce(($1->>''excludeCancelled'')::boolean,false) or p.status<>''cancelled'')
   and ($1->>''authorId'' is null or p.author_id=($1->>''authorId'')::uuid)
   and ($1->>''excludeAuthorId'' is null or p.author_id<>($1->>''excludeAuthorId'')::uuid)
   and ($1->>''category'' is null or p.discovery_category=$1->>''category'')
   and ($1->>''audience'' is null or $1->>''audience''=''all'' or coalesce(p.gender_preference,''any'')=$1->>''audience'')
   and (not coalesce(($1->>''freeOnly'')::boolean,false) or p.cost_cents=0)
   and ($1->>''from'' is null or p.starts_at>=($1->>''from'')::timestamptz)
   and ($1->>''until'' is null or p.starts_at<($1->>''until'')::timestamptz)
   and ($1->>''tag'' is null or p.tags @> array[$1->>''tag''])
   and ($1->>''search'' is null or position(lower($1->>''search'') in lower(p.title||'' ''||p.description||'' ''||coalesce(p.venue_name,'''')))>0)
   and ($1->''venueIds'' is null or p.venue_id in(select value::uuid from jsonb_array_elements_text($1->''venueIds'')))
   and ($7 is null or p.author_id=any($7))
   and ($2 is null or '||cursor_test||')
  order by '||ordering||' limit $3+1
 ), ranked as (
  select *,row_number() over(order by '||replace(ordering,'p.','')||') rn from candidates
 ), cards as (
  select r.rn,to_jsonb(c)||jsonb_build_object(''distance_km'',r.distance_m/1000) item,
   jsonb_build_object(''at'',case when $6=''newest'' then r.created_at else r.starts_at end,''startsAt'',r.starts_at,''id'',r.id,''distanceM'',r.distance_m) cursor
  from ranked r join public.post_cards c on c.id=r.id where r.rn<=$3
 )
 select jsonb_build_object(''items'',coalesce((select jsonb_agg(item order by rn) from cards),''[]''),
 ''cursor'',case when exists(select 1 from ranked where rn>$3) then (select cursor from cards order by rn desc limit 1) else null end)'
 into result using f,p_cursor,lim,origin,radius,sort,hosts;
 return result;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format then raise exception 'Choose valid discovery filters';
end;
$fn$ language plpgsql stable security invoker set search_path=public,pg_temp;
revoke all on function public.discover_posts(jsonb,jsonb,int) from public,anon;
grant execute on function public.discover_posts(jsonb,jsonb,int) to authenticated;

notify pgrst, 'reload schema';
commit;
