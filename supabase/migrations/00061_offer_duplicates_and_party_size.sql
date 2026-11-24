-- Offers: a business can run different offers at the same time. Publishing is
-- blocked only for a duplicate: a live offer with the same title (ignoring case
-- and spaces) on the same court or service name at overlapping times.
-- Bookings: 1 to 4 people. Offers that only share the default court name
-- ("Main"/"default") no longer block each other's bookings; offers that name
-- the same court still share it.
begin;

create or replace function offer_resource_shared(p_resource text) returns boolean
language sql immutable set search_path=public,pg_temp as $$
  select lower(btrim(coalesce(p_resource,''))) not in ('', 'main', 'default')
$$;
revoke all on function offer_resource_shared(text) from public, anon, authenticated;

create or replace function guard_offer_publish() returns trigger as $$
declare p profiles; dup text;
begin
 if tg_op='UPDATE' and new.business_id is distinct from old.business_id then raise exception 'offer ownership cannot change'; end if;
 -- Legacy malformed windows must still be cancellable without rewriting history.
 if tg_op='UPDATE' and new.status in ('ended','cancelled') and
  row(new.title,new.description,new.discount_pct,new.price_cents,new.starts_at,new.ends_at,new.slot_capacity,new.slot_minutes,new.resource_key,new.venue_id) is not distinct from
  row(old.title,old.description,old.discount_pct,old.price_cents,old.starts_at,old.ends_at,old.slot_capacity,old.slot_minutes,old.resource_key,old.venue_id) then return new; end if;
 if tg_op='UPDATE' and old.venue_id is null and new.venue_id is not null
   and current_setting('role',true) not in ('authenticated','anon')
   and (to_jsonb(new)-'venue_id') is not distinct from (to_jsonb(old)-'venue_id')
   and exists(select 1 from venues where id=new.venue_id and business_id=new.business_id and verified_at is not null)
 then return new; end if;
 if new.ends_at<=new.starts_at or new.ends_at-new.starts_at<make_interval(mins=>new.slot_minutes)
   or new.slot_capacity not between 1 and 500 or new.ends_at-new.starts_at>interval '31 days'
   or char_length(btrim(new.title)) not between 4 and 80
   or char_length(btrim(new.description)) not between 10 and 1000 then raise exception 'invalid offer details or booking window'; end if;
 select * into p from profiles where id=new.business_id for update;
 if p.account_type is distinct from 'business' or not p.onboarding_completed then raise exception 'business onboarding required'; end if;
 if new.venue_id is null then
   select id into new.venue_id from venues where business_id=new.business_id order by verified_at desc nulls last,created_at,id limit 1;
 end if;
 if new.venue_id is not null and not exists(select 1 from venues where id=new.venue_id and business_id=new.business_id) then
   raise exception 'choose a venue associated with your business';
 end if;
 if new.status='live' and p.verification_status is distinct from 'verified' then raise exception 'only verified businesses can publish'; end if;
 if new.status='live' and new.venue_id is null then raise exception 'Submit your business venue for verification before publishing.'; end if;
 if tg_op='INSERT' and new.starts_at<=now() then raise exception 'offer starts must be in the future'; end if;
 if tg_op='UPDATE' then
   if old.status in ('ended','cancelled') and new.status is distinct from old.status then raise exception 'ended offers cannot reopen'; end if;
   if old.status='live' and new.status='draft' then raise exception 'a live offer must be cancelled rather than returned to draft'; end if;
   if old.status='live' and row(new.starts_at,new.ends_at,new.slot_capacity,new.slot_minutes,new.resource_key,new.venue_id) is distinct from
     row(old.starts_at,old.ends_at,old.slot_capacity,old.slot_minutes,old.resource_key,old.venue_id) and not (old.venue_id is null and new.venue_id is not null
   and current_setting('role',true) not in ('authenticated','anon')
   and row(new.starts_at,new.ends_at,new.slot_capacity,new.slot_minutes,new.resource_key)
    is not distinct from row(old.starts_at,old.ends_at,old.slot_capacity,old.slot_minutes,old.resource_key))
  then raise exception 'live slot details cannot change'; end if;
 end if;
 if new.status='live' and (tg_op='INSERT' or old.status<>'live') then
   if new.ends_at<=now() then raise exception 'offer expired'; end if;
   select o.title into dup from offers o
    where o.id<>new.id and o.business_id=new.business_id and o.status='live' and o.ends_at>now()
      and lower(btrim(o.title))=lower(btrim(new.title))
      and lower(btrim(o.resource_key))=lower(btrim(new.resource_key))
      and o.starts_at<new.ends_at and o.ends_at>new.starts_at
    limit 1;
   if dup is not null then
     raise exception 'You already have a live offer called "%" at these times. Change the title or the dates.', btrim(dup);
   end if;
 end if;
 return new;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;

create or replace function book_offer_slot(p_slot_id uuid, p_party_size int) returns json as $$
declare s offer_slots;o offers;bid uuid;oid uuid;taken int;booking_id uuid; existing_id uuid; existing_party int;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 if p_party_size is null or p_party_size not between 1 and 4 then raise exception 'A booking can be for 1 to 4 people'; end if;
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
 -- Offers that name the same court or room share it.
 if offer_resource_shared(o.resource_key) and exists(select 1 from bookings b join offers other on other.id=b.offer_id join offer_slots bs on bs.id=b.slot_id
   where other.business_id=bid and lower(btrim(other.resource_key))=lower(btrim(o.resource_key)) and other.id<>o.id
     and b.status in ('pending','confirmed') and (b.status='confirmed' or b.hold_expires_at is null or b.hold_expires_at>now())
     and bs.starts_at<s.ends_at and bs.ends_at>s.starts_at) then raise exception 'resource already booked'; end if;
 select coalesce(sum(b.party_size),0) into taken from bookings b join offer_slots bs on bs.id=b.slot_id
 where b.offer_id=o.id and bs.starts_at<s.ends_at and bs.ends_at>s.starts_at and b.status in ('pending','confirmed')
   and (b.status='confirmed' or b.hold_expires_at is null or b.hold_expires_at>now());
 -- A retry after a lost response returns the same active reservation.
 select b.id,b.party_size into existing_id,existing_party from bookings b
 where b.slot_id=s.id and b.customer_id=auth.uid() and b.status in ('pending','confirmed')
 and (b.status='confirmed' or b.hold_expires_at is null or b.hold_expires_at>now())
 order by b.created_at desc,b.id desc limit 1;
 if existing_id is not null then
  if existing_party<>p_party_size then raise exception 'You already requested this slot. Manage the existing booking in Activity.'; end if;
  return json_build_object('booking_id',existing_id,'seats_left',greatest(0,s.capacity-taken));
 end if;
 -- Serialize this person's own bookings so the limits below hold under retries.
 perform 1 from profiles where id=auth.uid() for update;
 if exists(select 1 from bookings b where b.offer_id=o.id and b.customer_id=auth.uid()
   and b.status in ('pending','confirmed') and (b.status='confirmed' or b.hold_expires_at is null or b.hold_expires_at>now())
   and (b.slot at time zone 'Asia/Kolkata')::date=(s.starts_at at time zone 'Asia/Kolkata')::date) then
  raise exception 'You already have one booking for this offer on that day. Cancel it in Activity to pick another time.'; end if;
 if (select count(*) from bookings b where b.customer_id=auth.uid() and b.status='pending'
   and b.slot>now() and (b.hold_expires_at is null or b.hold_expires_at>now()))>=3 then
  raise exception 'You can have up to 3 requests waiting for a business to confirm. Try again once one is confirmed or cancelled.'; end if;
 if taken+p_party_size>s.capacity then raise exception 'not enough seats left for this slot'; end if;
 insert into bookings(offer_id,customer_id,slot_id,slot,party_size,status,hold_expires_at)
 values(o.id,auth.uid(),s.id,s.starts_at,p_party_size,'pending',least(now()+interval '30 minutes',s.starts_at)) returning id into booking_id;
 return json_build_object('booking_id',booking_id,'seats_left',s.capacity-taken-p_party_size);
end;
$$ language plpgsql security definer set search_path=public,pg_temp;

notify pgrst,'reload schema';
commit;
