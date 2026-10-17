-- Forward-only fixes for live offer, booking, chat, and request flows.
begin;

-- Customers retain the public offer context associated with their own history.
-- Definer helper avoids a recursive offers -> bookings -> offers RLS policy.
create or replace function has_offer_booking(p_offer_id uuid) returns boolean as $$
 select exists(select 1 from bookings where offer_id=p_offer_id and customer_id=auth.uid());
$$ language sql stable security definer set search_path=public;
revoke all on function has_offer_booking(uuid) from public,anon;
grant execute on function has_offer_booking(uuid) to authenticated;
drop policy "offers read live" on offers;
create policy "offers read live" on offers for select using (
 status='live' and ends_at>now() and exists(select 1 from profiles p where p.id=business_id and p.verification_status='verified')
);
create policy "customers retain booked offer context" on offers for select to authenticated
 using (has_offer_booking(id));

-- Validate complete windows on the server as well as in the app.
create or replace function guard_offer_publish() returns trigger as $$
declare p profiles;
begin
 if tg_op='UPDATE' and new.business_id is distinct from old.business_id then raise exception 'offer ownership cannot change'; end if;
 -- Legacy malformed windows must still be cancellable without rewriting history.
 if tg_op='UPDATE' and new.status in ('ended','cancelled') and
  row(new.title,new.description,new.discount_pct,new.price_cents,new.starts_at,new.ends_at,new.slot_capacity,new.slot_minutes,new.resource_key,new.venue_id) is not distinct from
  row(old.title,old.description,old.discount_pct,old.price_cents,old.starts_at,old.ends_at,old.slot_capacity,old.slot_minutes,old.resource_key,old.venue_id) then return new; end if;
 if new.ends_at<=new.starts_at or new.ends_at-new.starts_at<make_interval(mins=>new.slot_minutes)
   or new.slot_capacity not between 1 and 500 or new.ends_at-new.starts_at>interval '31 days'
   or char_length(btrim(new.title)) not between 4 and 80
   or char_length(btrim(new.description)) not between 10 and 1000 then raise exception 'invalid offer details or booking window'; end if;
 select * into p from profiles where id=new.business_id for update;
 if p.account_type is distinct from 'business' or not p.onboarding_completed then raise exception 'business onboarding required'; end if;
 if tg_op='INSERT' and new.venue_id is null then
   select id into new.venue_id from venues where business_id=new.business_id order by created_at,id limit 1;
 end if;
 if new.venue_id is not null and not exists(select 1 from venues where id=new.venue_id and business_id=new.business_id) then
   raise exception 'choose a venue associated with your business';
 end if;
 if new.status='live' and p.verification_status is distinct from 'verified' then raise exception 'only verified businesses can publish'; end if;
 if tg_op='INSERT' and new.starts_at<=now() then raise exception 'offer starts must be in the future'; end if;
 if tg_op='UPDATE' then
   if old.status in ('ended','cancelled') and new.status is distinct from old.status then raise exception 'ended offers cannot reopen'; end if;
   if old.status='live' and new.status='draft' then raise exception 'a live offer must be cancelled rather than returned to draft'; end if;
   if old.status='live' and row(new.starts_at,new.ends_at,new.slot_capacity,new.slot_minutes,new.resource_key,new.venue_id) is distinct from
     row(old.starts_at,old.ends_at,old.slot_capacity,old.slot_minutes,old.resource_key,old.venue_id) then raise exception 'live slot details cannot change'; end if;
 end if;
 if new.status='live' and (tg_op='INSERT' or old.status<>'live') then
   if new.ends_at<=now() then raise exception 'offer expired'; end if;
   if exists(select 1 from offers o where o.id<>new.id and o.business_id=new.business_id and o.resource_key=new.resource_key
     and o.status='live' and o.ends_at>now() and o.starts_at<new.ends_at and o.ends_at>new.starts_at) then raise exception 'another live offer overlaps this resource'; end if;
 end if;
 return new;
end;
$$ language plpgsql security definer set search_path=public;

-- Updates use the same business -> offer lock order as reservations.
-- Revoking both table and column privileges closes the old direct-write path.
revoke update on offers from anon,authenticated;
revoke update(title,description,discount_pct,price_cents,starts_at,ends_at,venue_id,slot_capacity,slot_minutes,resource_key,status) on offers from anon,authenticated;
create or replace function update_offer(p_offer_id uuid,p_patch jsonb) returns jsonb as $$
declare o offers; p profiles;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 if p_patch is null or jsonb_typeof(p_patch)<>'object' then raise exception 'invalid offer patch'; end if;
 if exists(select 1 from jsonb_object_keys(p_patch) k where k not in
  ('title','description','discount_pct','price_cents','starts_at','ends_at','venue_id','slot_capacity','slot_minutes','resource_key','status')) then raise exception 'protected offer field'; end if;
 select * into p from profiles where id=auth.uid() for update;
 select * into o from offers where id=p_offer_id and business_id=auth.uid() for update;
 if not found then raise exception 'offer not found or not yours'; end if;
 update offers set
 title=case when p_patch?'title' then btrim(p_patch->>'title') else title end,
 description=case when p_patch?'description' then btrim(p_patch->>'description') else description end,
 discount_pct=case when p_patch?'discount_pct' then (p_patch->>'discount_pct')::int else discount_pct end,
 price_cents=case when p_patch?'price_cents' then (p_patch->>'price_cents')::int else price_cents end,
 starts_at=case when p_patch?'starts_at' then (p_patch->>'starts_at')::timestamptz else starts_at end,
 ends_at=case when p_patch?'ends_at' then (p_patch->>'ends_at')::timestamptz else ends_at end,
 venue_id=case when p_patch?'venue_id' then (p_patch->>'venue_id')::uuid else venue_id end,
 slot_capacity=case when p_patch?'slot_capacity' then (p_patch->>'slot_capacity')::int else slot_capacity end,
 slot_minutes=case when p_patch?'slot_minutes' then (p_patch->>'slot_minutes')::int else slot_minutes end,
 resource_key=case when p_patch?'resource_key' then btrim(p_patch->>'resource_key') else resource_key end,
 status=case when p_patch?'status' then p_patch->>'status' else status end
 where id=o.id returning * into o;
 return to_jsonb(o)||jsonb_build_object('business',jsonb_build_object('display_name',coalesce(p.business_name,p.display_name)));
end;
$$ language plpgsql security definer set search_path=public;
revoke all on function update_offer(uuid,jsonb) from public,anon;
grant execute on function update_offer(uuid,jsonb) to authenticated;

-- Ending an offer releases its future reservations and notifies customers.
create or replace function cancel_ended_offer_bookings() returns trigger as $$
begin
 if new.status in ('ended','cancelled') and old.status is distinct from new.status then
  update bookings set status='cancelled' where offer_id=new.id and
   (status='pending' or (status='confirmed' and slot>now()));
 end if;
 return new;
end;
$$ language plpgsql security definer set search_path=public;
create trigger trg_cancel_ended_offer_bookings after update of status on offers
 for each row execute function cancel_ended_offer_bookings();
update bookings b set status='cancelled' from offers o where b.offer_id=o.id and o.status='cancelled'
 and (b.status='pending' or (b.status='confirmed' and b.slot>now()));

create or replace function available_offer_slots(p_offer_id uuid) returns jsonb as $$
 select coalesce(jsonb_agg(to_jsonb(t) order by t.starts_at),'[]'::jsonb) from (
  select s.id,s.starts_at,s.ends_at,s.capacity,
   case when exists(select 1 from bookings b join offers other on other.id=b.offer_id join offer_slots bs on bs.id=b.slot_id
    where other.business_id=o.business_id and other.resource_key=o.resource_key and other.id<>o.id
     and b.status in ('pending','confirmed') and (b.status='confirmed' or b.hold_expires_at is null or b.hold_expires_at>now())
     and bs.starts_at<s.ends_at and bs.ends_at>s.starts_at) then 0
   else greatest(0,s.capacity-coalesce((select sum(b.party_size)::int from bookings b join offer_slots bs on bs.id=b.slot_id
    where b.offer_id=s.offer_id and bs.starts_at<s.ends_at and bs.ends_at>s.starts_at and b.status in ('pending','confirmed')
     and (b.status='confirmed' or b.hold_expires_at is null or b.hold_expires_at>now())),0)) end as seats_left
  from offer_slots s join offers o on o.id=s.offer_id
  where s.offer_id=p_offer_id and s.starts_at>now() and o.ends_at>now() and
   ((o.status='live' and exists(select 1 from profiles p where p.id=o.business_id and p.verification_status='verified'))
    or (o.business_id=auth.uid() and o.status='draft'))
 )t;
$$ language sql stable security definer set search_path=public;

-- Server-owned message chronology; only membership RPCs can write read cursors.
revoke insert on messages from anon,authenticated;
grant insert(conversation_id,sender_id,body) on messages to authenticated;
revoke insert,update,delete on conversation_reads from anon,authenticated;
alter table messages alter column created_at set default clock_timestamp();
alter table messages add constraint messages_nonblank check(char_length(btrim(body)) between 1 and 2000) not valid;
create or replace function mark_conversation_read(p_conversation_id uuid,p_last_message_id uuid) returns void as $$
declare read_through timestamptz;
begin
 if auth.uid() is null or not exists(select 1 from conversations where id=p_conversation_id and (user_a=auth.uid() or user_b=auth.uid())) then raise exception 'not a conversation member'; end if;
 if p_last_message_id is null then return; end if;
 select created_at into read_through from messages where id=p_last_message_id and conversation_id=p_conversation_id;
 if not found then raise exception 'message does not belong to this conversation'; end if;
 insert into conversation_reads(conversation_id,user_id,last_read_at) values(p_conversation_id,auth.uid(),read_through)
 on conflict(conversation_id,user_id) do update set last_read_at=greatest(conversation_reads.last_read_at,excluded.last_read_at);
end;
$$ language plpgsql security definer set search_path=public;
create or replace function mark_conversation_read(p_conversation_id uuid) returns void as $$
 select mark_conversation_read(p_conversation_id,(select id from messages where conversation_id=p_conversation_id order by created_at desc,id desc limit 1));
$$ language sql security definer set search_path=public;
revoke all on function mark_conversation_read(uuid,uuid) from public,anon;
grant execute on function mark_conversation_read(uuid,uuid) to authenticated;

-- Resubmissions reuse a request row, so notify on a transition back to pending.
create or replace function notify_join_request() returns trigger as $$
declare v_title text;v_body text;v_user uuid;v_kind text;
begin
 if tg_op='INSERT' or (tg_op='UPDATE' and new.status='pending' and old.status is distinct from 'pending') then
  v_kind:='join_request';
  select p.author_id,'New join request',pr.display_name||' wants to join "'||p.title||'"'
   into v_user,v_title,v_body from posts p join profiles pr on pr.id=new.requester_id where p.id=new.post_id;
 elsif new.status='approved' and old.status is distinct from 'approved' then
  v_kind:='request_approved';v_user:=new.requester_id;
  select 'Request approved','You''re in! "'||title||'"' into v_title,v_body from posts where id=new.post_id;
 elsif new.status='declined' and old.status is distinct from 'declined' then
  v_kind:='request_declined';v_user:=new.requester_id;
  select 'Request declined','"'||title||'" didn''t work out this time' into v_title,v_body from posts where id=new.post_id;
 else return new; end if;
 insert into notifications(user_id,kind,title,body,ref_id) values(v_user,v_kind,v_title,v_body,new.post_id);
 return new;
end;
$$ language plpgsql security definer set search_path=public;
commit;
