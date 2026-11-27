-- Discover: when nothing is within the chosen distance, the app shows plans
-- anywhere, nearest first, instead of an empty feed. discover_posts accepts
-- anyDistance:true with a search point: no distance limit, only plans that have
-- a location, and the usual filters, sorting and paging.
begin;
create or replace function public.discover_posts(p_filters jsonb default '{}',p_cursor jsonb default null,p_limit int default 30) returns jsonb as $fn$
declare f jsonb:=coalesce(p_filters,'{}'); origin geography; radius double precision; lat double precision; lng double precision;
 lim int:=least(80,greatest(1,coalesce(p_limit,30))); sort text:=coalesce(f->>'sort','soonest'); wide boolean; ordering text; cursor_test text; result jsonb;
begin
 if not account_active(auth.uid()) then raise exception 'Account unavailable';end if;
 if jsonb_typeof(f)<>'object' or octet_length(f::text)>4000 or length(coalesce(f->>'search',''))>120
  or sort not in ('soonest','nearest','newest') or coalesce(f->>'status','open') not in ('open','all','closed','cancelled')
  or f->>'category' is not null and f->>'category' not in ('Play','Meet','Explore','Unwind')
  or f->>'audience' is not null and f->>'audience' not in ('all','any','male','female') then raise exception 'Choose valid discovery filters';end if;
 lat=(f->>'latitude')::double precision;lng=(f->>'longitude')::double precision;
 wide=coalesce((f->>'anyDistance')::boolean,false);
 if (lat is null)<>(lng is null) or wide and lat is null then raise exception 'Choose a valid search area';end if;
 if lat is not null then
  -- anyDistance: no distance limit, plans anywhere (with a location) by distance.
  radius=case when wide then null else coalesce((f->>'radiusM')::double precision,5000) end;
  if not(lat between -90 and 90 and lng between -180 and 180 and (wide or radius between 100 and 50000)) then raise exception 'Choose a valid area and distance';end if;
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
   and ($4 is null or ($5 is null and loc.point is not null) or st_dwithin(loc.point,$4,$5))
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
 into result using f,p_cursor,lim,origin,radius,sort;
 return result;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format then raise exception 'Choose valid discovery filters';
end;
$fn$ language plpgsql stable security invoker set search_path=public,pg_temp;
revoke all on function public.discover_posts(jsonb,jsonb,int) from public,anon;
grant execute on function public.discover_posts(jsonb,jsonb,int) to authenticated;
commit;
