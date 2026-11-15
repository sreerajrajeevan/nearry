-- 00041: fair-use limits on offer bookings.
-- - A booking is for at most 2 people.
-- - One active booking per person per offer per day (India time), so one
--   person cannot hold several slots of the same offer on the same day.
-- - At most 3 waiting (unconfirmed) requests per person at a time, so nobody
--   can hold many slots while businesses confirm.
-- A retry of the same slot still returns the existing booking.
begin;
create or replace function book_offer_slot(p_slot_id uuid,p_party_size int) returns json as $$
declare s offer_slots;o offers;bid uuid;oid uuid;taken int;booking_id uuid; existing_id uuid; existing_party int;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 if p_party_size is null or p_party_size not between 1 and 2 then raise exception 'A booking can be for 1 or 2 people'; end if;
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
$$ language plpgsql security definer set search_path=public;
commit;
