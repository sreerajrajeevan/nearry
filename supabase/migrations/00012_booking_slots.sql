-- Stable business-defined slots. Legacy bookings stay intact and are backfilled.
begin;
alter table offers add column if not exists slot_minutes int not null default 60 check(slot_minutes between 15 and 480),
 add column if not exists resource_key text not null default 'default' check(char_length(btrim(resource_key)) between 1 and 80);
create table offer_slots(
 id uuid primary key default gen_random_uuid(),offer_id uuid not null references offers(id) on delete cascade,
 starts_at timestamptz not null,ends_at timestamptz not null,capacity int not null check(capacity between 1 and 500),
 check(ends_at>starts_at),unique(offer_id,starts_at)
);
alter table offer_slots enable row level security;
create policy "slots visible with offer" on offer_slots for select using(exists(
 select 1 from offers o where o.id=offer_id and (o.status='live' or o.business_id=auth.uid())
));
grant select on offer_slots to authenticated;
revoke insert,update,delete on offer_slots from anon,authenticated;
alter table bookings add column if not exists slot_id uuid references offer_slots(id),
 add column if not exists hold_expires_at timestamptz;
-- Preserve all legacy timestamps and seat allocations; do not delete history.
insert into offer_slots(offer_id,starts_at,ends_at,capacity)
select b.offer_id,b.slot,b.slot+make_interval(mins=>o.slot_minutes),greatest(o.slot_capacity,least(500,sum(b.party_size)::int))
from bookings b join offers o on o.id=b.offer_id group by b.offer_id,b.slot,o.slot_minutes,o.slot_capacity;
update bookings b set slot_id=s.id from offer_slots s where s.offer_id=b.offer_id and s.starts_at=b.slot;
-- Existing pending reservations remain held. Only new bookings get a timed hold.
create or replace function build_offer_slots() returns trigger as $$
begin
 if tg_op='UPDATE' and row(new.starts_at,new.ends_at,new.slot_capacity,new.slot_minutes) is not distinct from
   row(old.starts_at,old.ends_at,old.slot_capacity,old.slot_minutes) then return new; end if;
 if tg_op='UPDATE' then
   if exists(select 1 from bookings where offer_id=new.id) then raise exception 'cannot reschedule an offer with bookings'; end if;
   delete from offer_slots where offer_id=new.id;
 end if;
 insert into offer_slots(offer_id,starts_at,ends_at,capacity)
 select new.id,t,t+make_interval(mins=>new.slot_minutes),new.slot_capacity
 from generate_series(new.starts_at,new.ends_at-make_interval(mins=>new.slot_minutes),make_interval(mins=>new.slot_minutes)) t;
 return new;
end;
$$ language plpgsql security definer set search_path=public;
-- Generate regular slots only when they do not overlap a legacy slot.
insert into offer_slots(offer_id,starts_at,ends_at,capacity)
select o.id,t,t+make_interval(mins=>o.slot_minutes),o.slot_capacity from offers o
cross join lateral generate_series(o.starts_at,o.ends_at-make_interval(mins=>o.slot_minutes),make_interval(mins=>o.slot_minutes)) t
where not exists(select 1 from offer_slots s where s.offer_id=o.id and s.starts_at<t+make_interval(mins=>o.slot_minutes) and s.ends_at>t)
on conflict do nothing;
create trigger trg_build_offer_slots after insert or update on offers for each row execute function build_offer_slots();
create or replace function guard_offer_publish() returns trigger as $$
declare p profiles;
begin
 if tg_op='UPDATE' and new.business_id is distinct from old.business_id then raise exception 'offer ownership cannot change'; end if;
 if new.ends_at<=new.starts_at or new.slot_capacity not between 1 and 500 or
   new.ends_at-new.starts_at>interval '31 days' or char_length(btrim(new.title)) not between 4 and 80 or
   char_length(btrim(new.description)) not between 10 and 1000 then raise exception 'invalid offer details'; end if;
 select * into p from profiles where id=new.business_id for update;
 if p.account_type is distinct from 'business' or not p.onboarding_completed then raise exception 'business onboarding required'; end if;
 if new.status='live' and p.verification_status is distinct from 'verified' then raise exception 'only verified businesses can publish'; end if;
 if tg_op='INSERT' and new.starts_at<=now() then raise exception 'offer starts must be in the future'; end if;
 if tg_op='UPDATE' then
   if old.status in ('ended','cancelled') and new.status is distinct from old.status then raise exception 'ended offers cannot reopen'; end if;
   if old.status='live' and row(new.starts_at,new.ends_at,new.slot_capacity,new.slot_minutes,new.resource_key,new.venue_id) is distinct from
     row(old.starts_at,old.ends_at,old.slot_capacity,old.slot_minutes,old.resource_key,old.venue_id) then raise exception 'live slot details cannot change'; end if;
 end if;
 if new.status='live' and (tg_op='INSERT' or old.status<>'live') then
   if new.ends_at<=now() then raise exception 'offer expired'; end if;
   if exists(select 1 from offers o where o.id<>new.id and o.business_id=new.business_id and o.resource_key=new.resource_key
     and o.status='live' and o.starts_at<new.ends_at and o.ends_at>new.starts_at) then raise exception 'another live offer overlaps this resource'; end if;
 end if;
 return new;
end;
$$ language plpgsql security definer set search_path=public;
drop trigger if exists trg_guard_offer_publish on offers;
create trigger trg_guard_offer_publish before insert or update on offers for each row execute function guard_offer_publish();
-- Authenticated clients only change owner fields. Immutable ownership and counters.
revoke insert,update,delete on offers from anon,authenticated;
grant insert(business_id,title,description,discount_pct,price_cents,starts_at,ends_at,venue_id,slot_capacity,slot_minutes,resource_key,status),
 update(title,description,discount_pct,price_cents,starts_at,ends_at,venue_id,slot_capacity,slot_minutes,resource_key,status) on offers to authenticated;
create or replace function book_offer_slot(p_slot_id uuid,p_party_size int) returns json as $$
declare s offer_slots;o offers;bid uuid;oid uuid;taken int;booking_id uuid;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 if p_party_size is null or p_party_size not between 1 and 50 then raise exception 'invalid party size'; end if;
 if not exists(select 1 from profiles where id=auth.uid() and account_type='personal' and onboarding_completed) then raise exception 'personal onboarding required'; end if;
 select offer_id into oid from offer_slots where id=p_slot_id;
 select business_id into bid from offers where id=oid;
 -- Serialize every resource reservation at the business, then offer, slot, booking.
 perform 1 from profiles where id=bid for update;
 select * into o from offers where id=oid for update;
 select * into s from offer_slots where id=p_slot_id for update;
 if not found or o.status<>'live' or o.ends_at<=now() then raise exception 'offer is not live'; end if;
 if o.business_id=auth.uid() then raise exception 'cannot book your own offer'; end if;
 if s.starts_at<=now() then raise exception 'slot must be in the future'; end if;
 if s.starts_at<o.starts_at or s.ends_at>o.ends_at then raise exception 'slot outside offer window'; end if;
 if not exists(select 1 from profiles where id=bid and verification_status='verified') then raise exception 'business is not verified'; end if;
 -- Overlapping legacy offers on one resource cannot bypass the slot model.
 if exists(select 1 from bookings b join offers other on other.id=b.offer_id join offer_slots bs on bs.id=b.slot_id
   where other.business_id=bid and other.resource_key=o.resource_key and other.id<>o.id
     and b.status in ('pending','confirmed') and (b.status='confirmed' or b.hold_expires_at is null or b.hold_expires_at>now())
     and bs.starts_at<s.ends_at and bs.ends_at>s.starts_at) then raise exception 'resource already booked'; end if;
 select coalesce(sum(b.party_size),0) into taken from bookings b join offer_slots bs on bs.id=b.slot_id
 where b.offer_id=o.id and bs.starts_at<s.ends_at and bs.ends_at>s.starts_at and b.status in ('pending','confirmed')
   and (b.status='confirmed' or b.hold_expires_at is null or b.hold_expires_at>now());
 if taken+p_party_size>s.capacity then raise exception 'not enough seats left for this slot'; end if;
 insert into bookings(offer_id,customer_id,slot_id,slot,party_size,status,hold_expires_at)
 values(o.id,auth.uid(),s.id,s.starts_at,p_party_size,'pending',least(now()+interval '30 minutes',s.starts_at)) returning id into booking_id;
 return json_build_object('booking_id',booking_id,'seats_left',s.capacity-taken-p_party_size);
end;
$$ language plpgsql security definer set search_path=public;
-- Keep the legacy function name, but require an exact registered slot.
create or replace function create_booking(p_offer_id uuid,p_slot timestamptz,p_party_size int) returns json as $$
declare sid uuid;
begin
 select id into sid from offer_slots where offer_id=p_offer_id and starts_at=p_slot;
 if sid is null then raise exception 'choose an available business-defined slot'; end if;
 return book_offer_slot(sid,p_party_size);
end;
$$ language plpgsql security definer set search_path=public;
create or replace function change_booking_status(p_booking_id uuid,p_status text) returns void as $$
declare b bookings;o offers;oid uuid;bid uuid;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select offer_id into oid from bookings where id=p_booking_id;
 select business_id into bid from offers where id=oid;
 perform 1 from profiles where id=bid for update;
 select * into o from offers where id=oid for update;
 select * into b from bookings where id=p_booking_id for update;
 if not found or (b.customer_id is distinct from auth.uid() and o.business_id is distinct from auth.uid()) then raise exception 'not your booking'; end if;
 if p_status='confirmed' then
   if o.business_id is distinct from auth.uid() then raise exception 'only business can confirm'; end if;
   if b.status<>'pending' or b.slot<=now() or o.status<>'live' or (b.hold_expires_at is not null and b.hold_expires_at<=now()) then raise exception 'booking cannot be confirmed'; end if;
 elsif p_status='cancelled' then if b.status='cancelled' then return; end if;
 else raise exception 'invalid booking transition'; end if;
 update bookings set status=p_status where id=b.id;
end;
$$ language plpgsql security definer set search_path=public;
create or replace function available_offer_slots(p_offer_id uuid) returns jsonb as $$
 select coalesce(jsonb_agg(to_jsonb(t) order by t.starts_at),'[]'::jsonb) from (
  select s.id,s.starts_at,s.ends_at,s.capacity,greatest(0,s.capacity-coalesce((
   select sum(b.party_size)::int from bookings b join offer_slots bs on bs.id=b.slot_id where b.offer_id=s.offer_id
    and bs.starts_at<s.ends_at and bs.ends_at>s.starts_at and b.status in ('pending','confirmed')
    and (b.status='confirmed' or b.hold_expires_at is null or b.hold_expires_at>now())
  ),0)) as seats_left from offer_slots s join offers o on o.id=s.offer_id
  where s.offer_id=p_offer_id and s.starts_at>now() and (o.status='live' or o.business_id=auth.uid())
 )t;
$$ language sql stable security definer set search_path=public;
create or replace function expire_booking_holds() returns int as $$
declare n int;
begin
 update bookings set status='cancelled' where status='pending' and hold_expires_at<=now();
 get diagnostics n=row_count;return n;
end;
$$ language plpgsql security definer set search_path=public;
revoke execute on function book_offer_slot(uuid,int),available_offer_slots(uuid),expire_booking_holds() from public,anon,authenticated;
grant execute on function book_offer_slot(uuid,int),available_offer_slots(uuid) to authenticated;
grant execute on function expire_booking_holds() to service_role;
commit;
