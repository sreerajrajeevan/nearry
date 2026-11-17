-- Opt-in group reservations. No existing rows are rewritten or deleted.
begin;

create table public.plan_offer_settings (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false
);
insert into public.plan_offer_settings(singleton,enabled) values(true,false);
alter table public.plan_offer_settings enable row level security;
revoke all on public.plan_offer_settings from public,anon,authenticated;
grant all on public.plan_offer_settings to service_role;

create table public.plan_offer_bundles (
  post_id uuid primary key references public.posts(id) on delete cascade,
  booking_id uuid unique references public.bookings(id) on delete set null,
  host_id uuid not null references public.profiles(id) on delete cascade,
  business_id uuid not null references public.profiles(id) on delete cascade,
  client_key uuid not null,
  request_payload jsonb not null,
  plan_title text not null,
  offer_title text not null,
  business_name text not null,
  venue_name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  party_size int not null check(party_size between 2 and 50),
  price_cents int not null check(price_cents between 0 and 100000000),
  status text not null check(status in ('pending','confirmed','cancelled')),
  hold_expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique(host_id,client_key)
);
create index plan_offer_bundles_business_idx on public.plan_offer_bundles(business_id);
alter table public.plan_offer_bundles enable row level security;
revoke all on public.plan_offer_bundles from public,anon,authenticated;
-- Exclude retry payloads from the read API; all exposed details are plan context.
grant select(post_id,booking_id,host_id,business_id,plan_title,offer_title,business_name,venue_name,
  starts_at,ends_at,party_size,price_cents,status,hold_expires_at) on public.plan_offer_bundles to authenticated;
grant all on public.plan_offer_bundles to service_role;
create policy "bundle follows plan visibility or owning business" on public.plan_offer_bundles
  for select to authenticated using(account_active(auth.uid()) and
    (exists(select 1 from public.posts p where p.id=post_id) or business_id=auth.uid()));

create function public.plan_offer_bundles_enabled() returns boolean as $$
  select coalesce((select enabled from public.plan_offer_settings where singleton),false);
$$ language sql stable security definer set search_path=public,pg_temp;
revoke all on function public.plan_offer_bundles_enabled() from public,anon;
grant execute on function public.plan_offer_bundles_enabled() to authenticated;

create function public.create_plan_offer_bundle(
  p_slot_id uuid,p_post jsonb,p_client_key uuid,p_expected_price_cents int
) returns jsonb as $$
declare
  s offer_slots; o offers; venue venues; business profiles; existing plan_offer_bundles;
  oid uuid; bid uuid; pid uuid; booking uuid; taken int; size int; payload jsonb;
begin
  if not personal_profile_ready(auth.uid()) then
    raise exception 'Complete your profile with name, gender and age before creating a plan';
  end if;
  if p_client_key is null or p_post is null or jsonb_typeof(p_post)<>'object' then
    raise exception 'Invalid plan request';
  end if;
  if exists(select 1 from jsonb_object_keys(p_post) k where k not in
    ('title','description','vacancies','tags','gender_preference','plan_details','expires_at')) then
    raise exception 'The offer supplies the venue, time and price';
  end if;
  payload:=jsonb_build_object('slot',p_slot_id,'post',p_post,'price',p_expected_price_cents);
  -- Lock the same rows and in the same order as ordinary bookings.
  select offer_id into oid from offer_slots where id=p_slot_id;
  select business_id into bid from offers where id=oid;
  select * into business from profiles where id=bid for update;
  select * into o from offers where id=oid for update;
  select * into s from offer_slots where id=p_slot_id for update;
  perform 1 from profiles where id=auth.uid() for update;
  select * into existing from plan_offer_bundles where host_id=auth.uid() and client_key=p_client_key;
  if found then
    if existing.request_payload is distinct from payload then raise exception 'This retry belongs to another plan'; end if;
    return jsonb_build_object('post_id',existing.post_id,'booking_id',existing.booking_id);
  end if;
  if not plan_offer_bundles_enabled() then raise exception 'Plans with offers are not enabled yet'; end if;
  if s.id is null or o.status<>'live' or o.ends_at<=now() or s.starts_at<=now()+interval '15 minutes'
    or s.starts_at<o.starts_at or s.ends_at>o.ends_at then raise exception 'Choose an available future offer slot'; end if;
  if business.verification_status<>'verified' or not account_active(bid) or
    not content_visible('offer',o.id) or users_blocked(auth.uid(),bid) then raise exception 'Business offer unavailable'; end if;
  if o.price_cents is null or o.price_cents is distinct from p_expected_price_cents then
    raise exception 'The offer price changed. Choose the offer again before publishing';
  end if;
  if o.slot_minutes not in (30,60,90,120,180,240) then raise exception 'This offer duration cannot be attached to a plan'; end if;
  select * into venue from venues where id=o.venue_id and business_id=bid and verified_at is not null;
  if venue.id is null then raise exception 'Choose an offer with a verified business venue'; end if;
  size:=(p_post->>'vacancies')::int+1;
  if size is null or size not between 2 and 50 then raise exception 'Choose 1 to 49 other people for a group offer'; end if;
  if o.price_cents::bigint*size>100000000 then raise exception 'The group total exceeds the booking limit'; end if;
  if exists(select 1 from bookings b where b.customer_id=auth.uid() and b.offer_id=o.id
    and b.status in ('pending','confirmed') and (b.status='confirmed' or b.hold_expires_at is null or b.hold_expires_at>now())
    and (b.slot at time zone 'Asia/Kolkata')::date=(s.starts_at at time zone 'Asia/Kolkata')::date) then
    raise exception 'You already have a booking for this offer on that day'; end if;
  if (select count(*) from bookings b where b.customer_id=auth.uid() and b.status='pending'
    and b.slot>now() and (b.hold_expires_at is null or b.hold_expires_at>now()))>=3 then
    raise exception 'You already have 3 requests waiting for business confirmation'; end if;
  if exists(select 1 from bookings b join offers other on other.id=b.offer_id join offer_slots bs on bs.id=b.slot_id
    where other.business_id=bid and other.resource_key=o.resource_key and other.id<>o.id
    and b.status in ('pending','confirmed') and (b.status='confirmed' or b.hold_expires_at is null or b.hold_expires_at>now())
    and bs.starts_at<s.ends_at and bs.ends_at>s.starts_at) then raise exception 'That resource is already booked'; end if;
  select coalesce(sum(b.party_size),0) into taken from bookings b join offer_slots bs on bs.id=b.slot_id
    where b.offer_id=o.id and bs.starts_at<s.ends_at and bs.ends_at>s.starts_at and b.status in ('pending','confirmed')
    and (b.status='confirmed' or b.hold_expires_at is null or b.hold_expires_at>now());
  if taken>0 or taken+size>s.capacity then raise exception 'Not enough places for your whole group. Choose an empty slot'; end if;
  -- Existing post validation, profile, audience, age and chat triggers still run.
  insert into posts(author_id,title,description,vacancies,tags,gender_preference,plan_details,
    venue_id,venue_name,starts_at,expires_at,cost_cents)
  values(auth.uid(),btrim(p_post->>'title'),btrim(p_post->>'description'),size-1,
    coalesce(array(select jsonb_array_elements_text(p_post->'tags')),'{}'),p_post->>'gender_preference',
    coalesce(p_post->'plan_details','{}'::jsonb)||jsonb_build_object('durationMinutes',o.slot_minutes,'costMode','person','venueBooked',false),
    venue.id,venue.name,s.starts_at,(p_post->>'expires_at')::timestamptz,o.price_cents) returning id into pid;
  insert into bookings(offer_id,customer_id,slot_id,slot,party_size,status,hold_expires_at)
  values(o.id,auth.uid(),s.id,s.starts_at,size,'pending',least(now()+interval '30 minutes',s.starts_at)) returning id into booking;
  insert into plan_offer_bundles(post_id,booking_id,host_id,business_id,client_key,request_payload,plan_title,offer_title,
    business_name,venue_name,starts_at,ends_at,party_size,price_cents,status,hold_expires_at)
  select pid,b.id,auth.uid(),bid,p_client_key,payload,btrim(p_post->>'title'),o.title,coalesce(nullif(business.business_name,''),business.display_name),
    venue.name,s.starts_at,s.ends_at,size,o.price_cents,b.status,b.hold_expires_at from bookings b where b.id=booking;
  return jsonb_build_object('post_id',pid,'booking_id',booking);
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.create_plan_offer_bundle(uuid,jsonb,uuid,int) from public,anon;
grant execute on function public.create_plan_offer_bundle(uuid,jsonb,uuid,int) to authenticated;

-- A group owns the time block, not just some seats on the same court.
-- The ordinary booking RPC already holds the business/offer/slot locks before
-- this insert trigger, so it cannot race a group publication into that block.
create function public.guard_booking_against_plan_bundle() returns trigger as $$
begin
  if new.status not in ('pending','confirmed') then return new; end if;
  if exists(
    select 1 from offers requested join offer_slots requested_slot on requested_slot.id=new.slot_id
    join offers other on other.business_id=requested.business_id and other.resource_key=requested.resource_key
    join bookings held on held.offer_id=other.id
    join offer_slots held_slot on held_slot.id=held.slot_id
    join plan_offer_bundles bundle on bundle.booking_id=held.id
    where requested.id=new.offer_id and held.status in ('pending','confirmed')
      and (held.status='confirmed' or held.hold_expires_at>now())
      and held_slot.starts_at<requested_slot.ends_at and held_slot.ends_at>requested_slot.starts_at
  ) then raise exception 'resource already booked by a plan group'; end if;
  return new;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
create trigger guard_booking_against_plan_bundle before insert on bookings
  for each row execute function guard_booking_against_plan_bundle();
revoke all on function public.guard_booking_against_plan_bundle() from public,anon,authenticated;

-- Keep the existing listing logic; suppress remaining-seat suggestions on a
-- time block already reserved for a group, including in older app builds.
alter function public.available_offer_slots(uuid) rename to available_offer_slots_before_bundles;
create function public.available_offer_slots(p_offer_id uuid) returns jsonb as $$
  select coalesce(jsonb_agg(case when exists(
    select 1 from offers requested
    join offers other on other.business_id=requested.business_id and other.resource_key=requested.resource_key
    join bookings held on held.offer_id=other.id
    join offer_slots held_slot on held_slot.id=held.slot_id
    join plan_offer_bundles bundle on bundle.booking_id=held.id
    where requested.id=p_offer_id and held.status in ('pending','confirmed')
      and (held.status='confirmed' or held.hold_expires_at>now())
      and held_slot.starts_at<(item->>'ends_at')::timestamptz
      and held_slot.ends_at>(item->>'starts_at')::timestamptz
  ) then jsonb_set(item,'{seats_left}','0'::jsonb) else item end order by item->>'starts_at'),'[]'::jsonb)
  from jsonb_array_elements(available_offer_slots_before_bundles(p_offer_id)) item;
$$ language sql stable security definer set search_path=public,pg_temp;
revoke all on function public.available_offer_slots_before_bundles(uuid),public.available_offer_slots(uuid) from public,anon,authenticated;
grant execute on function public.available_offer_slots(uuid) to authenticated;
grant execute on function public.available_offer_slots_before_bundles(uuid) to service_role;

-- Never let older app builds edit a reserved slot or approve expired capacity.
create function public.guard_bundle_plan() returns trigger as $$
begin
  if exists(select 1 from plan_offer_bundles where post_id=old.id) and
    (row(new.venue_id,new.venue_name,new.location_lat,new.location_lng,new.location_source,new.location_place_id,
       new.starts_at,new.vacancies,new.cost_cents) is distinct from
     row(old.venue_id,old.venue_name,old.location_lat,old.location_lng,old.location_source,old.location_place_id,
       old.starts_at,old.vacancies,old.cost_cents)
     or (new.plan_details-'activity'-'level'-'ageMin'-'ageMax') is distinct from
        (old.plan_details-'activity'-'level'-'ageMin'-'ageMax')) then
    raise exception 'This plan has a group reservation. Cancel it and create another to change venue, time, capacity or price';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
create trigger guard_bundle_plan before update on posts for each row execute function guard_bundle_plan();

create function public.guard_bundle_join() returns trigger as $$
declare bundle plan_offer_bundles; business profiles; booking bookings;
begin
  if new.status not in ('pending','approved') then return new; end if;
  if tg_op='UPDATE' and new.status is not distinct from old.status then return new; end if;
  select * into bundle from plan_offer_bundles where post_id=new.post_id;
  if not found then return new; end if;
  select * into booking from bookings where id=bundle.booking_id;
  if booking.id is null or booking.status='cancelled' or
    (booking.status='pending' and booking.hold_expires_at<=now()) then
    -- Capacity reopening must never prevent another member from leaving.
    if tg_op='UPDATE' and old.status='full' and new.status='pending' then new.status:='declined';return new;end if;
    raise exception 'The venue reservation is cancelled or expired. This plan cannot accept joins';
  end if;
  select * into business from profiles where id=bundle.business_id;
  if not account_active(bundle.business_id) or business.verification_status<>'verified' or
    not content_visible('offer',booking.offer_id) or
    users_blocked(bundle.business_id,new.requester_id) then raise exception 'Business reservation unavailable'; end if;
  return new;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
create trigger guard_bundle_join before insert or update on join_requests for each row execute function guard_bundle_join();

create function public.sync_bundle_plan_title() returns trigger as $$
begin
  update plan_offer_bundles set plan_title=new.title where post_id=new.id;
  return new;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
create trigger sync_bundle_plan_title after update of title on posts for each row execute function sync_bundle_plan_title();

alter table notifications drop constraint notifications_kind_check;
alter table notifications add constraint notifications_kind_check check(kind in (
 'join_request','request_approved','request_declined','request_full','post_cancelled',
 'booking','booking_confirmed','booking_cancelled','message','verification_approved',
 'verification_rejected','selfie_review','plan_group_message','plan_booking_confirmed'));

create function public.sync_bundle_booking() returns trigger as $$
begin
  update plan_offer_bundles set status=new.status,hold_expires_at=new.hold_expires_at where booking_id=new.id;
  if new.status='confirmed' and old.status is distinct from new.status then
    insert into notifications(user_id,kind,title,body,ref_id)
    select r.requester_id,'plan_booking_confirmed','Venue booking confirmed',
      'The venue confirmed "'||p.title||'". Pay ₹'||booking_notice_rupees(bundle.price_cents)||' per person at the venue.',p.id
    from plan_offer_bundles bundle join posts p on p.id=bundle.post_id
    join join_requests r on r.post_id=p.id and r.status='approved'
    where bundle.booking_id=new.id;
  end if;
  if new.status='cancelled' and old.status is distinct from new.status then
    update posts p set status='cancelled' from plan_offer_bundles bundle
      where bundle.booking_id=new.id and p.id=bundle.post_id and p.status<>'cancelled' and p.starts_at>now();
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
create trigger sync_bundle_booking after update of status,hold_expires_at on bookings for each row execute function sync_bundle_booking();

create function public.release_bundle_booking() returns trigger as $$
begin
  if tg_op='DELETE' then
    update bookings set status='cancelled' where id=old.booking_id and status<>'cancelled' and slot>now();
    return old;
  end if;
  if new.status='cancelled' and old.status is distinct from new.status then
    update bookings b set status='cancelled' from plan_offer_bundles bundle
      where bundle.post_id=new.id and b.id=bundle.booking_id and b.status<>'cancelled' and b.slot>now();
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
create trigger release_bundle_booking after update of status on posts for each row execute function release_bundle_booking();
create trigger release_deleted_bundle_booking after delete on plan_offer_bundles for each row execute function release_bundle_booking();
create function public.cancel_bundle_without_booking() returns trigger as $$
begin
  if new.booking_id is null and old.booking_id is not null then
    update plan_offer_bundles set status='cancelled' where post_id=new.post_id;
    update posts set status='cancelled' where id=new.post_id and status<>'cancelled' and starts_at>now();
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
create trigger cancel_bundle_without_booking after update of booking_id on plan_offer_bundles for each row execute function cancel_bundle_without_booking();

-- Reserve/cancel must use business → offer → booking/post order in both apps.
-- Preserve old implementations (and authorization) for unbundled plans.
alter function public.cancel_post(uuid) rename to cancel_post_before_bundles;
alter function public.delete_post(uuid) rename to delete_post_before_bundles;
create function public.lock_plan_offer_reservation(p_post_id uuid) returns void as $$
declare bundle plan_offer_bundles; oid uuid;
begin
  select * into bundle from plan_offer_bundles where post_id=p_post_id;
  if found then
    perform 1 from profiles where id=bundle.business_id for update;
    select offer_id into oid from bookings where id=bundle.booking_id;
    perform 1 from offers where id=oid for update;
    perform 1 from bookings where id=bundle.booking_id for update;
  end if;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
create function public.cancel_post(p_post_id uuid) returns void as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from posts where id=p_post_id and author_id=auth.uid()) then raise exception 'post not found or not yours'; end if;
  perform lock_plan_offer_reservation(p_post_id);
  perform cancel_post_before_bundles(p_post_id);
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
create function public.delete_post(p_post_id uuid) returns void as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from posts where id=p_post_id and author_id=auth.uid()) then raise exception 'post not found or not yours'; end if;
  perform lock_plan_offer_reservation(p_post_id);
  perform delete_post_before_bundles(p_post_id);
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.cancel_post_before_bundles(uuid),public.delete_post_before_bundles(uuid),
  public.lock_plan_offer_reservation(uuid),public.sync_bundle_plan_title(),public.guard_bundle_plan(),public.guard_bundle_join(),public.sync_bundle_booking(),
  public.release_bundle_booking(),public.cancel_bundle_without_booking() from public,anon,authenticated;
grant execute on function public.cancel_post_before_bundles(uuid),public.delete_post_before_bundles(uuid) to service_role;
revoke all on function public.cancel_post(uuid),public.delete_post(uuid) from public,anon;
grant execute on function public.cancel_post(uuid),public.delete_post(uuid) to authenticated;
-- Group confirmations use their saved price, even if the public offer changes.
create or replace function notify_booking() returns trigger as $$
declare
  v_title text;
  v_body text;
  v_user uuid;
  v_kind text;
  v_offer text;
  v_business text;
  v_business_id uuid;
  v_price int;
  bundle plan_offer_bundles;
  v_when text := booking_notice_when(new.slot);
  v_people text := new.party_size || case when new.party_size = 1 then ' person' else ' people' end;
begin
  select o.title, o.business_id, o.price_cents, coalesce(nullif(btrim(pr.display_name), ''), 'the business')
    into v_offer, v_business_id, v_price, v_business
  from offers o left join profiles pr on pr.id = o.business_id
  where o.id = new.offer_id;

  select * into bundle from plan_offer_bundles where booking_id=new.id;
  if found then
    v_offer:=bundle.offer_title; v_business:=bundle.business_name; v_price:=bundle.price_cents;
  end if;

  if tg_op = 'INSERT' then
    v_kind := 'booking';
    v_user := v_business_id;
    v_title := 'New booking request';
    select coalesce(nullif(btrim(pr.display_name), ''), 'Someone')
           || ' wants ' || v_people || ' for "' || v_offer || '" · ' || v_when
           || '. Waiting for you to confirm.'
      into v_body from profiles pr where pr.id = new.customer_id;
    v_body := coalesce(v_body, 'New request for "' || v_offer || '" · ' || v_when);
  elsif tg_op = 'UPDATE' and new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    v_kind := 'booking_confirmed';
    v_user := new.customer_id;
    v_title := 'Booking confirmed';
    v_body := '"' || v_offer || '" at ' || v_business || ' · ' || v_when || ' · ' || v_people || '. '
      || case
           when v_price = 0 then 'It''s free.'
           when v_price > 0 and new.party_size > 1 then
             'Pay ₹' || booking_notice_rupees(v_price * new.party_size) || ' at the venue (₹'
             || booking_notice_rupees(v_price) || ' / person).'
           when v_price > 0 then 'Pay ₹' || booking_notice_rupees(v_price) || ' at the venue (per person).'
           else 'Pay at the venue.'
         end;
  elsif tg_op = 'UPDATE' and new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    v_kind := 'booking_cancelled';
    -- notify the other party, whoever cancelled
    v_user := case when new.customer_id = auth.uid() then v_business_id else new.customer_id end;
    v_title := 'Booking cancelled';
    v_body := '"' || v_offer || '" · ' || v_when || ' was cancelled.';
  else
    return new;
  end if;

  insert into notifications (user_id, kind, title, body, ref_id)
  values (v_user, v_kind, v_title, v_body, new.offer_id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;


create or replace function notify_post_cancelled() returns trigger as $$
begin
 if new.status='cancelled' and old.status is distinct from new.status then
  insert into notifications(user_id,kind,title,body,ref_id)
  select requester_id,'post_cancelled','Plan cancelled',case when exists(select 1 from plan_offer_bundles where post_id=new.id) then '"'||new.title||'" and its venue reservation were cancelled' else '"'||new.title||'" was cancelled by the host' end,new.id
  from join_requests where post_id=new.id and status in ('pending','approved');
 end if;
 return new;
end;
$$ language plpgsql security definer set search_path=public;

-- New plan notices are also removed by the existing account-deletion worker.
create or replace function prepare_auth_deletion(p_user uuid) returns void as $$
begin
 perform 1 from account_deletion_jobs where user_id=p_user for update;
 if exists(select 1 from account_deletion_jobs where user_id=p_user and prepared_at is not null) then return;end if;
 if not exists(select 1 from profiles where id=p_user and deletion_requested_at is not null) then raise exception 'Deletion not requested';end if;
 if exists(select 1 from storage.objects where split_part(name,'/',1)=p_user::text) then raise exception 'Remove stored files first';end if;
 delete from venue_photos where venue_id in(select id from venues where business_id=p_user);
 update venues set business_id=null where business_id=p_user;
 delete from content_reports where reporter_id=p_user or subject_user_id=p_user;
 -- Notifications are copies of messages/plan titles and may outlive their source.
 delete from notifications where ref_id in(select id from conversations where p_user in(user_a,user_b)) or message_id in(select id from messages where sender_id=p_user)
  or (kind in ('join_request','request_approved','request_declined','post_cancelled','plan_booking_confirmed') and ref_id in(select id from posts where author_id=p_user))
  or (kind='join_request' and ref_id in(select post_id from join_requests where requester_id=p_user))
  or (kind in ('booking','booking_confirmed','booking_cancelled') and ref_id in(select offer_id from bookings where customer_id=p_user or offer_id in(select id from offers where business_id=p_user)));
 -- Keep a generic, non-identifying explanation for affected neighbours after
 -- the original post/booking and its copied notification text are removed.
 insert into notifications(user_id,kind,title,body)
 select distinct r.requester_id,'post_cancelled','Plan cancelled','A plan was cancelled because an account is no longer available. Review your activity.'
 from join_requests r join posts p on p.id=r.post_id where p.author_id=p_user and r.requester_id<>p_user and p.starts_at>now();
 insert into notifications(user_id,kind,title,body)
 select distinct b.customer_id,'booking_cancelled','Booking cancelled','A booking was cancelled because an account is no longer available. Review your activity.'
 from bookings b join offers o on o.id=b.offer_id where o.business_id=p_user and b.customer_id<>p_user and b.slot>now();
 insert into notifications(user_id,kind,title,body)
 select distinct o.business_id,'booking_cancelled','Booking cancelled','A booking was cancelled because an account is no longer available. Review your bookings.'
 from bookings b join offers o on o.id=b.offer_id where b.customer_id=p_user and o.business_id<>p_user and b.slot>now();
 update account_deletion_jobs set prepared_at=now() where user_id=p_user;
end;
$$ language plpgsql security definer set search_path=public;

notify pgrst,'reload schema';
commit;
