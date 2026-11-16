-- 00047 — Nearry Premium: server-side "Hosted by" filter.
-- Gender is never readable across profiles; the filter runs only inside this
-- security-definer function, which returns host ids (open, upcoming plans
-- only) and is Premium-gated. nearby_post_cards gains an optional host-gender
-- argument; the old three-argument call keeps working through the default.
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
 where p.status='open' and p.starts_at>now() and pr.gender=p_gender;
end;
$$ language plpgsql stable security definer set search_path = public, pg_temp;
revoke all on function public.hosts_matching_gender(text) from public, anon;
grant execute on function public.hosts_matching_gender(text) to authenticated;

drop function if exists public.nearby_post_cards(double precision,double precision,double precision);
create function public.nearby_post_cards(p_lat double precision,p_lng double precision,p_radius_m double precision,p_host_gender text default null)
returns setof jsonb as $$
declare hosts uuid[];
begin
 if p_lat is null or p_lng is null or p_radius_m is null or
  not (p_lat between -90 and 90 and p_lng between -180 and 180 and p_radius_m between 100 and 50000) then
  raise exception 'invalid location or radius';
 end if;
 if p_host_gender is not null then
  hosts := array(select public.hosts_matching_gender(p_host_gender));
 end if;
 return query
 select to_jsonb(c)||jsonb_build_object('distance_km',st_distance(spot.point,origin.point)/1000)
 from public.post_cards c left join public.venues v on v.id=c.venue_id
 cross join lateral (select st_setsrid(st_makepoint(p_lng,p_lat),4326)::geography as point) origin
 cross join lateral (select case when c.location_lat is not null and c.location_lng is not null
  then st_setsrid(st_makepoint(c.location_lng,c.location_lat),4326)::geography else v.location end as point) spot
 where c.status='open' and c.starts_at>now() and (c.expires_at is null or c.expires_at>now())
  and spot.point is not null and st_dwithin(spot.point,origin.point,p_radius_m)
  and (p_host_gender is null or c.author_id=any(hosts))
 order by st_distance(spot.point,origin.point),c.starts_at,c.id;
end;
$$ language plpgsql stable security invoker set search_path=public,pg_temp;
revoke all on function public.nearby_post_cards(double precision,double precision,double precision,text) from public,anon;
grant execute on function public.nearby_post_cards(double precision,double precision,double precision,text) to authenticated;

notify pgrst, 'reload schema';
commit;
