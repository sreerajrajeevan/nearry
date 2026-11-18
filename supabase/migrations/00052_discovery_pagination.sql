-- Indexed discovery with bounded, filter-aware cursor pages.
-- 00051 is reserved for the existing independent plan/offer bundle branch.
begin;
create function public.discovery_category(p_title text,p_tags text[]) returns text as $$
 select case
 when regexp_replace(normalize(lower(coalesce(p_title,'')||' '||array_to_string(coalesce(p_tags,'{}'),' ')),NFD),'[̀-ͯ]','','g') ~ '(^|[^a-z0-9_])(football|cricket|sports?|games?|turf|match|badminton|tennis|running|run|cycling|swimming|swim|volleyball|basketball)([^a-z0-9_]|$)' then 'Play'
 when regexp_replace(normalize(lower(coalesce(p_title,'')||' '||array_to_string(coalesce(p_tags,'{}'),' ')),NFD),'[̀-ͯ]','','g') ~ '(^|[^a-z0-9_])(coffee|cafe|restaurant|dining|meet|chat|dinner|lunch|drinks?|social|movie|tea|chaya|food|brunch)([^a-z0-9_]|$)' then 'Meet'
 when regexp_replace(normalize(lower(coalesce(p_title,'')||' '||array_to_string(coalesce(p_tags,'{}'),' ')),NFD),'[̀-ͯ]','','g') ~ '(^|[^a-z0-9_])(salon|haircut|spa|massage|wellness|yoga|meditation|relax|unwind)([^a-z0-9_]|$)' then 'Unwind'
 else 'Explore' end;
$$ language sql immutable parallel safe set search_path=public,pg_temp;
alter table public.posts add column discovery_category text generated always as (public.discovery_category(title,tags)) stored;
create index posts_open_schedule on public.posts(starts_at,id) where status='open';
create index posts_open_category_schedule on public.posts(discovery_category,starts_at,id) where status='open';
create index posts_created_page on public.posts(created_at desc,starts_at,id);
create index posts_author_page on public.posts(author_id,created_at desc,id);

-- A separate RLS table keeps the cached spatial index out of the public post
-- row and makes Google's coordinate expiry apply even to direct REST reads.
create table public.post_locations(
 post_id uuid primary key references public.posts(id) on delete cascade,
 point geography(point, 4326) not null
);
alter table public.post_locations enable row level security;
revoke all on public.post_locations from public,anon,authenticated;
grant select on public.post_locations to authenticated;
grant all on public.post_locations to service_role;
create policy "visible current plan locations" on public.post_locations for select using(
 exists(select 1 from public.posts p where p.id=post_id and
 (p.venue_id is not null or p.location_source is distinct from 'google' or p.location_cached_at>now()-interval '29 days'))
);
create index post_locations_point_gist on public.post_locations using gist(point);
insert into public.post_locations(post_id,point)
 select p.id,coalesce(case when p.location_lat is not null and (p.location_source is distinct from 'google' or p.location_cached_at>now()-interval '29 days')
 then st_setsrid(st_makepoint(p.location_lng,p.location_lat),4326)::geography end,v.location)
 from public.posts p left join public.venues v on v.id=p.venue_id
 where coalesce(case when p.location_lat is not null and (p.location_source is distinct from 'google' or p.location_cached_at>now()-interval '29 days')
 then st_setsrid(st_makepoint(p.location_lng,p.location_lat),4326)::geography end,v.location) is not null;

create function public.sync_post_location_index() returns trigger as $$
declare spot geography;
begin
 if new.location_lat is not null and (new.location_source is distinct from 'google' or new.location_cached_at>now()-interval '29 days') then
  spot=st_setsrid(st_makepoint(new.location_lng,new.location_lat),4326)::geography;
 elsif new.venue_id is not null then select location into spot from public.venues where id=new.venue_id;end if;
 if spot is null then delete from public.post_locations where post_id=new.id;
 else insert into public.post_locations values(new.id,spot) on conflict(post_id) do update set point=excluded.point;end if;
 return new;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.sync_post_location_index() from public,anon,authenticated;
create trigger sync_post_location_index after insert or update of venue_id,location_lat,location_lng,location_cached_at,location_source on public.posts
 for each row execute function public.sync_post_location_index();
create function public.sync_venue_location_index() returns trigger as $$
begin
 insert into public.post_locations(post_id,point)
 select id,new.location from public.posts where venue_id=new.id and new.location is not null and (location_lat is null or location_source='google' and location_cached_at<=now()-interval '29 days')
 on conflict(post_id) do update set point=excluded.point;
 if new.location is null then delete from public.post_locations where post_id in(select id from public.posts where venue_id=new.id and (location_lat is null or location_source='google' and location_cached_at<=now()-interval '29 days'));end if;
 return new;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.sync_venue_location_index() from public,anon,authenticated;
create trigger sync_venue_location_index after update of location on public.venues for each row execute function public.sync_venue_location_index();

create function public.discover_posts(p_filters jsonb default '{}',p_cursor jsonb default null,p_limit int default 30) returns jsonb as $fn$
declare f jsonb:=coalesce(p_filters,'{}'); origin geography; radius double precision; lat double precision; lng double precision;
 lim int:=least(80,greatest(1,coalesce(p_limit,30))); sort text:=coalesce(f->>'sort','soonest'); ordering text; cursor_test text; result jsonb;
begin
 if not account_active(auth.uid()) then raise exception 'Account unavailable';end if;
 if jsonb_typeof(f)<>'object' or octet_length(f::text)>4000 or length(coalesce(f->>'search',''))>120
  or sort not in ('soonest','nearest','newest') or coalesce(f->>'status','open') not in ('open','all','closed','cancelled')
  or f->>'category' is not null and f->>'category' not in ('Play','Meet','Explore','Unwind')
  or f->>'audience' is not null and f->>'audience' not in ('all','any','male','female') then raise exception 'Choose valid discovery filters';end if;
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


create function public.offer_discovery_kind(p_text text) returns text as $$
 select case
 when normalize(lower(p_text),NFD) ~ '\m(gym|fitness|workout|training|strength|pilates|crossfit)\M' then 'fitness'
 when normalize(lower(p_text),NFD) ~ '\m(football|cricket|badminton|tennis|sports?|turf|court|swimming|cycling)\M' then 'sports'
 when regexp_replace(normalize(lower(p_text),NFD),'[̀-ͯ]','','g') ~ '\m(food|cafe|coffee|restaurant|dining|lunch|dinner|brunch|meal|pizza|biriyani|biryani)\M' then 'food'
 when normalize(lower(p_text),NFD) ~ '\m(wellness|yoga|salon|spa|haircut|massage|meditation|unwind|relax)\M' then 'wellness'
 else 'all' end;
$$ language sql immutable parallel safe set search_path=public,pg_temp;
create index offers_venue_ending_page on public.offers(venue_id,ends_at,id) where status='live';
create index offers_live_ending_page on public.offers(is_spotlight desc,ends_at,id) where status='live';
create function public.discover_offers(p_filters jsonb default '{}',p_cursor jsonb default null,p_limit int default 30) returns jsonb as $$
declare f jsonb:=coalesce(p_filters,'{}'); origin geography; lat double precision; lng double precision; radius double precision;
 lim int:=least(80,greatest(1,coalesce(p_limit,30))); result jsonb;
begin
 if not account_active(auth.uid()) then raise exception 'Account unavailable';end if;
 if jsonb_typeof(f)<>'object' or octet_length(f::text)>4000 or length(coalesce(f->>'search',''))>120
 or coalesce(f->>'category','all') not in ('all','fitness','sports','food','wellness')
 or f->>'discoveryCategory' is not null and f->>'discoveryCategory' not in ('Play','Meet','Unwind','Explore') then raise exception 'Choose valid offer filters';end if;
 lat=(f->>'latitude')::double precision;lng=(f->>'longitude')::double precision;
 if (lat is null)<>(lng is null) then raise exception 'Choose a valid search area';end if;
 if lat is not null then
 radius=coalesce((f->>'radiusM')::double precision,5000);
 if not(lat between -90 and 90 and lng between -180 and 180 and radius between 100 and 50000) then raise exception 'Choose a valid area and distance';end if;
 origin=st_setsrid(st_makepoint(lng,lat),4326)::geography;
 end if;
 with rows as (
 select o.*,case when origin is not null then st_distance(v.location,origin)/1000 end distance_km,
 offer_discovery_kind(o.title||' '||o.description||' '||coalesce(o.discovery_business_name,o.discovery_display_name,'')) bucket
 from discovery_offers o left join venues v on v.id=o.venue_id
 where o.status='live' and o.ends_at>now() and (o.max_redemptions is null or o.redemptions<o.max_redemptions)
 and (origin is null or st_dwithin(v.location,origin,radius))
 and (not coalesce((f->>'spotlight')::boolean,false) or o.is_spotlight)
 and (f->'venueIds' is null or o.venue_id in(select value::uuid from jsonb_array_elements_text(f->'venueIds')))
 and (f->>'search' is null or position(lower(f->>'search') in lower(o.title||' '||o.description||' '||coalesce(o.discovery_business_name,o.discovery_display_name,'')))>0)
 and (p_cursor is null or o.is_spotlight<(p_cursor->>'spotlight')::boolean or o.is_spotlight=(p_cursor->>'spotlight')::boolean and (o.ends_at,o.id)>((p_cursor->>'at')::timestamptz,(p_cursor->>'id')::uuid))
 ), filtered as (
 select * from rows where (coalesce(f->>'category','all')='all' or bucket=f->>'category')
 and (f->>'discoveryCategory' is null or
  (case bucket when 'fitness' then 'Play' when 'sports' then 'Play' when 'food' then 'Meet' when 'wellness' then 'Unwind'
   else discovery_category(title||' '||description||' '||coalesce(discovery_business_name,discovery_display_name,''),'{}') end)=f->>'discoveryCategory')
 order by is_spotlight desc,ends_at,id limit lim+1
 ), numbered as (select *,row_number() over(order by is_spotlight desc,ends_at,id) rn from filtered)
 select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(numbered)-'rn'-'bucket' order by rn) filter(where rn<=lim),'[]'),
 'cursor',case when count(*)>lim then (select jsonb_build_object('at',ends_at,'id',id,'spotlight',is_spotlight) from numbered where rn=lim) else null end)
 into result from numbered;
 return result;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format then raise exception 'Choose valid offer filters';
end;
$$ language plpgsql stable security invoker set search_path=public,pg_temp;
revoke all on function public.discover_offers(jsonb,jsonb,int) from public,anon;
grant execute on function public.discover_offers(jsonb,jsonb,int) to authenticated;

-- Directory previews are bounded independently of the paged plan/offer feeds.
create or replace function public.nearby_venues_with_distance(p_lat double precision,p_lng double precision,p_radius_m int)
returns jsonb as $$
begin
 if p_lat is null or p_lng is null or not(p_lat between -90 and 90 and p_lng between -180 and 180 and p_radius_m between 100 and 50000) then raise exception 'invalid location or radius';end if;
 return (select coalesce(jsonb_agg(to_jsonb(t) order by t.distance_m),'[]') from (
 select v.*,st_distance(v.location,st_setsrid(st_makepoint(p_lng,p_lat),4326)::geography) distance_m from venues v
 where v.location is not null and st_dwithin(v.location,st_setsrid(st_makepoint(p_lng,p_lat),4326)::geography,p_radius_m)
 order by v.location <-> st_setsrid(st_makepoint(p_lng,p_lat),4326)::geography,v.id limit 80
 )t);
end;
$$ language plpgsql stable security invoker set search_path=public,pg_temp;
revoke all on function public.discovery_category(text,text[]),public.offer_discovery_kind(text) from public,anon;
grant execute on function public.discovery_category(text,text[]),public.offer_discovery_kind(text) to authenticated,service_role;

-- Older builds keep the same response shape, with a safe result bound.
create or replace function public.nearby_post_cards(p_lat double precision,p_lng double precision,p_radius_m double precision)
returns setof jsonb as $$
 select value from jsonb_array_elements(public.discover_posts(jsonb_build_object('latitude',p_lat,'longitude',p_lng,'radiusM',p_radius_m,'sort','nearest'),null,80)->'items');
$$ language sql stable security invoker set search_path=public,pg_temp;
notify pgrst,'reload schema';
commit;

