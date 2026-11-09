-- External meeting spots belong to a plan, never the verified business directory.
begin;
alter table public.posts
 add column location_lat double precision,
 add column location_lng double precision,
 add column location_source text,
 add column location_place_id text,
 add column location_cached_at timestamptz,
 add constraint post_location_valid check (
   (location_lat is null and location_lng is null or
    location_lat between -90 and 90 and location_lng between -180 and 180 and location_lat is not null and location_lng is not null)
   and (location_source is null or location_source in ('google','manual','geoapify','demo'))
   and (location_lat is null or location_source is not null)
   and (location_source is distinct from 'google' or location_place_id ~ '^[A-Za-z0-9_-]+$' and char_length(location_place_id) between 1 and 512 and location_place_id is not null)
 );
grant update(location_lat,location_lng,location_source,location_place_id) on public.posts to authenticated;
create function public.guard_post_location() returns trigger as $$
begin
 if current_user='authenticated' and tg_op='UPDATE' then
  if old.author_id is distinct from auth.uid() or old.status<>'open' or old.starts_at<=now() then
   raise exception 'only the host can change an upcoming open plan location';
  end if;
 end if;
 if new.location_lat is not null then
  if char_length(btrim(coalesce(new.venue_name,''))) not between 1 and 120 or new.venue_id is not null then
   raise exception 'external locations need a host-entered name and cannot claim a Nearry venue';
  end if;
 end if;
 if tg_op='UPDATE' and row(new.location_lat,new.location_lng,new.location_source,new.location_place_id)
   is not distinct from row(old.location_lat,old.location_lng,old.location_source,old.location_place_id) then
  new.location_cached_at=old.location_cached_at;
 elsif new.location_source='google' and new.location_lat is not null then
  new.location_cached_at=now();
 else new.location_cached_at=null;
 end if;
 return new;
end;
$$ language plpgsql set search_path=public,pg_temp;
revoke all on function public.guard_post_location() from public,anon,authenticated;
create trigger guard_post_location before insert or update of location_lat,location_lng,location_source,location_place_id,location_cached_at,venue_name,venue_id
 on public.posts for each row execute function public.guard_post_location();

-- Keep the read-model column order and its invoker/RLS behavior. Google-derived
-- coordinates disappear from reads after 29 days, even if maintenance is delayed.
create or replace view public.post_cards with (security_invoker=true) as
 select p.id,p.author_id,p.title,p.description,p.venue_id,p.venue_name,p.starts_at,p.vacancies,p.tags,p.status,p.created_at,
 p.expires_at,p.cost_cents,pr.display_name as author_name,public.approved_join_count(p.id) as approved_count,p.gender_preference,
 case when p.location_source<>'google' or p.location_cached_at>now()-interval '29 days' then p.location_lat end as location_lat,
 case when p.location_source<>'google' or p.location_cached_at>now()-interval '29 days' then p.location_lng end as location_lng,
 p.location_source,p.location_place_id,p.location_cached_at
 from public.posts p join public.profiles pr on pr.id=p.author_id;

-- RLS is retained on both posts and venues; an external post does not need a
-- registered venue to be found. Legacy plans fall back to the venue's point.
create function public.nearby_post_cards(p_lat double precision,p_lng double precision,p_radius_m double precision)
returns setof jsonb as $$
begin
 if p_lat is null or p_lng is null or p_radius_m is null or
  not (p_lat between -90 and 90 and p_lng between -180 and 180 and p_radius_m between 100 and 50000) then
  raise exception 'invalid location or radius';
 end if;
 return query
 select to_jsonb(c)||jsonb_build_object('distance_km',st_distance(spot.point,origin.point)/1000)
 from public.post_cards c left join public.venues v on v.id=c.venue_id
 cross join lateral (select st_setsrid(st_makepoint(p_lng,p_lat),4326)::geography as point) origin
 cross join lateral (select case when c.location_lat is not null and c.location_lng is not null
  then st_setsrid(st_makepoint(c.location_lng,c.location_lat),4326)::geography else v.location end as point) spot
 where c.status='open' and c.starts_at>now() and (c.expires_at is null or c.expires_at>now())
  and spot.point is not null and st_dwithin(spot.point,origin.point,p_radius_m)
 order by st_distance(spot.point,origin.point),c.starts_at,c.id;
end;
$$ language plpgsql stable security invoker set search_path=public,pg_temp;
revoke all on function public.nearby_post_cards(double precision,double precision,double precision) from public,anon;
grant execute on function public.nearby_post_cards(double precision,double precision,double precision) to authenticated;

-- Existing five-minute maintenance deletes the temporary Google coordinate
-- cache before its 30-day maximum. Keep IDs and independently entered labels.
alter function public.maintenance_retention_cleanup() rename to maintenance_retention_before_locations;
revoke all on function public.maintenance_retention_before_locations() from public,anon,authenticated,service_role;
create function public.maintenance_retention_cleanup() returns void as $$
begin
 perform public.maintenance_retention_before_locations();
 update public.posts set location_lat=null,location_lng=null,location_cached_at=null
 where location_source='google' and location_cached_at<=now()-interval '29 days';
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.maintenance_retention_cleanup() from public,anon,authenticated;
grant execute on function public.maintenance_retention_cleanup() to service_role;
notify pgrst,'reload schema';
commit;
