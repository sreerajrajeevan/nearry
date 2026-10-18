-- Forward-only core journey fixes. Existing posts, bookings and messages remain intact.
begin;

alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check check (kind in (
 'join_request','request_approved','request_declined','post_cancelled',
 'booking','booking_confirmed','booking_cancelled','message',
 'verification_approved','verification_rejected'
));

-- Tie new message notices to the actual message, not a transaction timestamp.
alter table notifications add column message_id uuid references messages(id) on delete set null;
create index notifications_unread_conversation_idx on notifications(user_id,ref_id)
 where kind='message' and read_at is null;
create or replace function notify_message() returns trigger as $$
declare recipient uuid; sender_name text;
begin
 select case when c.user_a=new.sender_id then c.user_b else c.user_a end
 into recipient from conversations c where c.id=new.conversation_id;
 select display_name into sender_name from profiles where id=new.sender_id;
 insert into notifications(user_id,kind,title,body,ref_id,message_id)
 values(recipient,'message','Message from '||coalesce(sender_name,'someone'),left(new.body,140),new.conversation_id,new.id);
 return new;
end;
$$ language plpgsql security definer set search_path=public;

create or replace function mark_conversation_read(p_conversation_id uuid,p_last_message_id uuid) returns void as $$
declare read_through timestamptz;
begin
 if auth.uid() is null or not exists(select 1 from conversations where id=p_conversation_id and (user_a=auth.uid() or user_b=auth.uid())) then
  raise exception 'not a conversation member';
 end if;
 select created_at into read_through from messages where id=p_last_message_id and conversation_id=p_conversation_id;
 if not found then
  if p_last_message_id is null then return; end if;
  raise exception 'message does not belong to this conversation';
 end if;
 insert into conversation_reads(conversation_id,user_id,last_read_at) values(p_conversation_id,auth.uid(),read_through)
 on conflict(conversation_id,user_id) do update set last_read_at=greatest(conversation_reads.last_read_at,excluded.last_read_at);
 update notifications n set read_at=clock_timestamp()
 where n.user_id=auth.uid() and n.kind='message' and n.ref_id=p_conversation_id and n.read_at is null and (
  exists(select 1 from messages m where m.id=n.message_id and m.conversation_id=p_conversation_id and m.created_at<=read_through)
  or (n.message_id is null and n.created_at<read_through)
 );
end;
$$ language plpgsql security definer set search_path=public;

-- One snapshot for badges; a chat message counts once even when it has a notice.
create or replace function unread_counts() returns jsonb as $$
 select jsonb_build_object(
  'messages',(select count(*) from messages m join conversations c on c.id=m.conversation_id
   left join conversation_reads r on r.conversation_id=c.id and r.user_id=auth.uid()
   where (c.user_a=auth.uid() or c.user_b=auth.uid()) and m.sender_id<>auth.uid()
   and m.created_at>coalesce(r.last_read_at,'1970-01-01'::timestamptz)),
  'notifications',(select count(*) from notifications where user_id=auth.uid() and read_at is null),
  'other_notifications',(select count(*) from notifications where user_id=auth.uid() and kind<>'message' and read_at is null)
 );
$$ language sql stable security definer set search_path=public;
revoke all on function unread_counts() from public,anon;
grant execute on function unread_counts() to authenticated;

-- Notify everyone affected by a host cancellation, including pending requests.
create or replace function notify_post_cancelled() returns trigger as $$
begin
 if new.status='cancelled' and old.status is distinct from new.status then
  insert into notifications(user_id,kind,title,body,ref_id)
  select requester_id,'post_cancelled','Plan cancelled','"'||new.title||'" was cancelled by the host',new.id
  from join_requests where post_id=new.id and status in ('pending','approved');
 end if;
 return new;
end;
$$ language plpgsql security definer set search_path=public;
create trigger trg_notify_post_cancelled after update of status on posts
 for each row execute function notify_post_cancelled();

-- Reservations are safe to retry when a mobile response is lost.
create or replace function book_offer_slot(p_slot_id uuid,p_party_size int) returns json as $$
declare s offer_slots;o offers;bid uuid;oid uuid;taken int;booking_id uuid; existing_id uuid; existing_party int;
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
 -- A retry after a lost response returns the same active reservation.
 select b.id,b.party_size into existing_id,existing_party from bookings b
 where b.slot_id=s.id and b.customer_id=auth.uid() and b.status in ('pending','confirmed')
 and (b.status='confirmed' or b.hold_expires_at is null or b.hold_expires_at>now())
 order by b.created_at desc,b.id desc limit 1;
 if existing_id is not null then
  if existing_party<>p_party_size then raise exception 'You already requested this slot. Manage the existing booking in Activity.'; end if;
  return json_build_object('booking_id',existing_id,'seats_left',greatest(0,s.capacity-taken));
 end if;
 if taken+p_party_size>s.capacity then raise exception 'not enough seats left for this slot'; end if;
 insert into bookings(offer_id,customer_id,slot_id,slot,party_size,status,hold_expires_at)
 values(o.id,auth.uid(),s.id,s.starts_at,p_party_size,'pending',least(now()+interval '30 minutes',s.starts_at)) returning id into booking_id;
 return json_build_object('booking_id',booking_id,'seats_left',s.capacity-taken-p_party_size);
end;
$$ language plpgsql security definer set search_path=public;

commit;
