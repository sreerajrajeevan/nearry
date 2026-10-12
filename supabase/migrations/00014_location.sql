begin;
create or replace function nearby_venues_with_distance(p_lat double precision,p_lng double precision,p_radius_m int)
returns jsonb as $$
begin
 if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180
  or p_radius_m is null or p_radius_m not between 100 and 50000 then raise exception 'invalid location or radius'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(t) order by t.distance_m),'[]'::jsonb) from (
  select v.*,st_distance(v.location,st_setsrid(st_makepoint(p_lng,p_lat),4326)::geography) as distance_m from venues v
  where v.location is not null and st_dwithin(v.location,st_setsrid(st_makepoint(p_lng,p_lat),4326)::geography,p_radius_m)
 )t);
end;
$$ language plpgsql stable security invoker set search_path=public;
revoke execute on function nearby_venues_with_distance(double precision,double precision,int) from public;
grant execute on function nearby_venues_with_distance(double precision,double precision,int) to authenticated;
-- Refresh this view without changing existing column positions.
create or replace view business_bookings with (security_invoker=true) as
select b.id,b.offer_id,b.customer_id,b.slot,b.party_size,b.status,b.created_at,
 o.business_id,o.title as offer_title,c.display_name as customer_name,b.slot_id,b.hold_expires_at
from bookings b join offers o on o.id=b.offer_id join profiles c on c.id=b.customer_id;
commit;
