-- Confirmed November review fixes. Forward-only; existing content/history is retained.
begin;

create index bookings_slot_state on public.bookings(slot_id,status,hold_expires_at) include(party_size,offer_id);
create index bookings_offer_time on public.bookings(offer_id,slot,id) include(status,party_size,hold_expires_at);
create index bookings_customer_time on public.bookings(customer_id,status,slot,id);
create index conversations_user_a on public.conversations(user_a,id);
create index conversations_user_b on public.conversations(user_b,id);
create index joins_post_state on public.join_requests(post_id,status);
create index notices_user_page on public.notifications(user_id,created_at desc,id desc);
create index push_jobs_ready on public.push_jobs(next_attempt_at,id) where sent_at is null and attempts<5;

-- Client edits must not strip a previously required meeting place. Trusted
-- retention jobs may still clear expired Google coordinates as designed.
create function public.require_edited_meeting_place() returns trigger as $$
begin
 if current_user='authenticated' and new.venue_id is null and
   (char_length(btrim(coalesce(new.venue_name,''))) not between 1 and 120 or new.location_lat is null or new.location_lng is null)
 then raise exception 'Select a meeting place or add a place with coordinates before saving.'; end if;
 return new;
end;
$$ language plpgsql set search_path=public,pg_temp;
revoke all on function public.require_edited_meeting_place() from public,anon,authenticated;
create trigger zz_require_edited_meeting_place before update of venue_id,venue_name,location_lat,location_lng on public.posts
 for each row execute function public.require_edited_meeting_place();

create function public.offer_booking_counts(p_ids uuid[]) returns jsonb as $$
begin
 if not public.account_active(auth.uid()) or cardinality(p_ids)>100 then raise exception 'Account unavailable or too many offers';end if;
 return (select coalesce(jsonb_object_agg(q.id,q.n),'{}') from
  (select o.id,count(b.id) n from offers o left join bookings b on b.offer_id=o.id
   and (b.status='confirmed' or b.status='pending' and (b.hold_expires_at is null or b.hold_expires_at>now()))
   where o.id=any(p_ids) and o.business_id=auth.uid() group by o.id) q);
end;
$$ language plpgsql stable security definer set search_path=public,pg_temp;
revoke all on function public.offer_booking_counts(uuid[]) from public,anon;
grant execute on function public.offer_booking_counts(uuid[]) to authenticated;

-- Retries return the original direct message rather than inserting duplicates.
alter table public.messages add column client_key text check(client_key is null or char_length(client_key) between 8 and 100);
create unique index direct_message_client_key on public.messages(conversation_id,sender_id,client_key) where client_key is not null;
grant insert(client_key) on public.messages to authenticated;
create function public.send_direct_message(p_conversation uuid,p_body text,p_client_key text) returns jsonb as $$
declare m messages;
begin
 if not account_active(auth.uid()) or p_body is null or char_length(btrim(p_body)) not between 1 and 2000
 or p_client_key is null or char_length(p_client_key) not between 8 and 100 then raise exception 'Write a message under 2000 characters';end if;
 -- Serialize this sender's retry without taking other participants' profile locks.
 perform 1 from profiles where id=auth.uid() for update;
 select * into m from messages where conversation_id=p_conversation and sender_id=auth.uid() and client_key=p_client_key;
 if found then
   if m.body<>btrim(p_body) then raise exception 'This send was already used for another message';end if;
   return to_jsonb(m)||jsonb_build_object('sender',jsonb_build_object('display_name',(select display_name from profiles where id=auth.uid())));
 end if;
 insert into messages(conversation_id,sender_id,body,client_key) values(p_conversation,auth.uid(),btrim(p_body),p_client_key) returning * into m;
 return to_jsonb(m)||jsonb_build_object('sender',jsonb_build_object('display_name',(select display_name from profiles where id=auth.uid())));
end;
$$ language plpgsql security invoker set search_path=public,pg_temp;
revoke all on function public.send_direct_message(uuid,text,text) from public,anon;
grant execute on function public.send_direct_message(uuid,text,text) to authenticated;

-- Keep every underlying notice for read boundaries/history, but present one
-- latest chat card per conversation. No old notice IDs or read states change.
alter table public.notifications add column thread_key uuid;
update public.notifications set thread_key=ref_id where kind='message';
update public.notifications n set thread_key=m.group_id from public.plan_group_messages m
 where n.kind='plan_group_message' and n.ref_id=m.id;
create index notices_thread_page on public.notifications(user_id,kind,thread_key,created_at desc,id desc) where thread_key is not null;
create function public.notice_thread_key() returns trigger as $$
begin
 if new.kind='message' then new.thread_key=new.ref_id;
 elsif new.kind='plan_group_message' then select group_id into new.thread_key from plan_group_messages where id=new.ref_id;
 else new.thread_key=null;end if;
 return new;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.notice_thread_key() from public,anon,authenticated;
create trigger notice_thread_key before insert on public.notifications for each row execute function public.notice_thread_key();

create function public.notification_cards(p_limit int default 40,p_cursor jsonb default null,p_updates_only boolean default false) returns jsonb as $$
declare rows jsonb; tail jsonb; lim int:=least(80,greatest(1,coalesce(p_limit,40)));
begin
 if not account_active(auth.uid()) then raise exception 'Account unavailable';end if;
 with candidates as (
  select n.*,case when n.thread_key is null then (n.read_at is null)::int else
   (select count(*)::int from notifications u where u.user_id=auth.uid() and u.kind=n.kind and u.thread_key=n.thread_key and u.read_at is null) end unread_count
  from notifications n
  where n.user_id=auth.uid() and notification_allowed(auth.uid(),n.kind,n.ref_id)
   and (not p_updates_only or n.kind not in ('message','plan_group_message'))
   and (p_cursor is null or (n.created_at,n.id)<((p_cursor->>'at')::timestamptz,(p_cursor->>'id')::uuid))
   and (n.thread_key is null or not exists(select 1 from notifications newer where newer.user_id=n.user_id and newer.kind=n.kind and newer.thread_key=n.thread_key and notification_allowed(auth.uid(),newer.kind,newer.ref_id) and (newer.created_at,newer.id)>(n.created_at,n.id)))
  order by n.created_at desc,n.id desc limit lim+1
 ), numbered as (select *,row_number() over(order by created_at desc,id desc) rn from candidates)
 select coalesce(jsonb_agg(to_jsonb(numbered)-'rn' order by created_at desc,id desc) filter(where rn<=lim),'[]'),
  to_jsonb(max(case when rn=lim+1 then 1 else 0 end)) into rows,tail from numbered;
 if tail='1'::jsonb then tail=jsonb_build_object('at',rows->(lim-1)->>'created_at','id',rows->(lim-1)->>'id');else tail=null;end if;
 return jsonb_build_object('items',rows,'cursor',tail);
end;
$$ language plpgsql stable security definer set search_path=public,pg_temp;
revoke all on function public.notification_cards(int,jsonb,boolean) from public,anon;
grant execute on function public.notification_cards(int,jsonb,boolean) to authenticated;

create function public.change_notice_thread(p_id uuid,p_action text) returns void as $$
declare n notifications;
begin
 if not account_active(auth.uid()) or p_action not in ('read','unread','delete') then raise exception 'Account unavailable or invalid action';end if;
 select * into n from notifications where id=p_id and user_id=auth.uid();
 if not found then return;end if;
 if p_action='delete' then
  delete from notifications x where x.user_id=auth.uid() and
   (x.id=n.id or n.thread_key is not null and x.kind=n.kind and x.thread_key=n.thread_key and (x.created_at,x.id)<=(n.created_at,n.id));
 else
  update notifications x set read_at=case when p_action='read' then clock_timestamp() else null end where x.user_id=auth.uid() and
   (x.id=n.id or n.thread_key is not null and x.kind=n.kind and x.thread_key=n.thread_key and (x.created_at,x.id)<=(n.created_at,n.id));
 end if;
end;
$$ language plpgsql security invoker set search_path=public,pg_temp;
revoke all on function public.change_notice_thread(uuid,text) from public,anon;
grant execute on function public.change_notice_thread(uuid,text) to authenticated;

alter function public.unread_counts() rename to unread_counts_before_review;
revoke all on function public.unread_counts_before_review() from public,anon,authenticated;
create function public.unread_counts() returns jsonb as $$
declare result jsonb; notices bigint; others bigint; direct_count bigint; group_count bigint;
begin
 if not account_active(auth.uid()) then return jsonb_build_object('messages',0,'notifications',0,'other_notifications',0);end if;
 select count(*) into direct_count from messages m join conversations c on c.id=m.conversation_id
 left join conversation_reads r on r.conversation_id=c.id and r.user_id=auth.uid()
 left join conversation_clears d on d.conversation_id=c.id and d.user_id=auth.uid()
 where (c.user_a=auth.uid() or c.user_b=auth.uid()) and m.sender_id<>auth.uid()
 and account_active(c.user_a) and account_active(c.user_b) and not users_blocked(c.user_a,c.user_b)
 and m.created_at>greatest(coalesce(r.last_read_at,'1970-01-01'::timestamptz),coalesce(d.cleared_at,'1970-01-01'::timestamptz));
 with eligible as materialized(
 select g.id from plan_groups g where g.post_id in(select id from posts where author_id=auth.uid() union select post_id from join_requests where requester_id=auth.uid() and status='approved') and plan_group_member(g.id,auth.uid())
 ) select count(*) into group_count from eligible g join plan_group_messages m on m.group_id=g.id left join plan_group_reads r on r.group_id=g.id and r.user_id=auth.uid() where m.sender_id<>auth.uid() and m.seq>coalesce(r.last_seq,0) and visible_author(m.sender_id) and content_visible('plan_message',m.id);
 result=jsonb_build_object('messages',direct_count+group_count);
 select count(distinct case when thread_key is null then id::text else kind||':'||thread_key::text end),
 count(*) filter(where kind not in ('message','plan_group_message')) into notices,others
 from notifications where user_id=auth.uid() and read_at is null and notification_allowed(auth.uid(),kind,ref_id);
 return result||jsonb_build_object('notifications',notices,'other_notifications',others);
end;
$$ language plpgsql stable security definer set search_path=public,pg_temp;
revoke all on function public.unread_counts() from public,anon;
grant execute on function public.unread_counts() to authenticated;

-- Coalesce pending chat bursts; approvals/bookings have priority. This is a
-- worker batch size, not an Expo/device quota. In-flight jobs are not replaced.
create or replace function public.claim_push_jobs() returns jsonb as $$
begin
 update push_jobs j set sent_at=now(),last_error='coalesced chat preview'
 where j.id in (
  select old.id from push_jobs old join notifications n on n.id=old.notification_id
  where old.sent_at is null and (old.attempts=0 or old.next_attempt_at<=now()) and n.thread_key is not null
  and exists(select 1 from notifications m
    where m.user_id=n.user_id and m.kind=n.kind and m.thread_key=n.thread_key and (m.created_at,m.id)>(n.created_at,n.id))
  order by old.next_attempt_at limit 500
 );
 return (
 with jobs as(
  select j.id from push_jobs j join notifications n on n.id=j.notification_id join profiles p on p.id=n.user_id
  where j.sent_at is null and j.attempts<5 and j.next_attempt_at<=now() and p.push_enabled
  and notification_allowed(n.user_id,n.kind,n.ref_id)
  and (n.thread_key is null or not exists(select 1 from notifications m where m.user_id=n.user_id and m.kind=n.kind and m.thread_key=n.thread_key and (m.created_at,m.id)>(n.created_at,n.id)))
  order by case when n.kind in ('message','plan_group_message') then 1 else 0 end,j.next_attempt_at,j.id
  for update of j skip locked limit 25
 ),claimed as (
  update push_jobs j set attempts=j.attempts+1,next_attempt_at=now()+interval '2 minutes' from jobs where jobs.id=j.id returning j.id,j.notification_id
 ) select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'notification_id',n.id,'user_id',n.user_id,'kind',n.kind,'ref_id',n.ref_id,'thread_key',n.thread_key,'title',n.title,'body',n.body)),'[]')
 from claimed c join notifications n on n.id=c.notification_id);
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
create function public.release_push_jobs(p_ids uuid[]) returns void as $$
 update push_jobs set attempts=greatest(0,attempts-1),next_attempt_at=now() where id=any(p_ids) and sent_at is null;
$$ language sql security definer set search_path=public,pg_temp;
revoke all on function public.release_push_jobs(uuid[]) from public,anon,authenticated;
grant execute on function public.release_push_jobs(uuid[]) to service_role;

-- A device-held capability can revoke its own registration after local logout,
-- including a later online retry. It grants no read or registration access.
alter table public.push_tokens add column revoke_hash bytea;
create function public.register_push_installation(p_token text,p_platform text,p_secret text) returns void as $$
begin
 if p_secret is null or p_secret !~ '^[a-f0-9]{64}$' then raise exception 'Invalid installation';end if;
 perform register_push_token(p_token,p_platform);
 update push_tokens set revoke_hash=sha256(convert_to(p_secret,'UTF8')) where token=p_token and user_id=auth.uid();
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
create function public.revoke_push_installation(p_token text,p_secret text) returns void as $$
begin
 if p_token is null or char_length(p_token)>256 or p_secret is null or p_secret !~ '^[a-f0-9]{64}$' then return;end if;
 delete from push_tokens where token=p_token and revoke_hash=sha256(convert_to(p_secret,'UTF8'));
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.register_push_installation(text,text,text) from public,anon;
grant execute on function public.register_push_installation(text,text,text) to authenticated;
revoke all on function public.revoke_push_installation(text,text) from public;
grant execute on function public.revoke_push_installation(text,text) to anon,authenticated;

-- Blocked/inactive accounts must not consume the paid place-search allowance.
alter function public.reserve_place_search(uuid) rename to reserve_place_search_before_review;
revoke all on function public.reserve_place_search_before_review(uuid) from public,anon,authenticated,service_role;
create function public.reserve_place_search(p_user_id uuid) returns boolean as $$
begin
 if not account_active(p_user_id) then return false;end if;
 return reserve_place_search_before_review(p_user_id);
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.reserve_place_search(uuid) from public,anon,authenticated;
grant execute on function public.reserve_place_search(uuid) to service_role;

notify pgrst,'reload schema';
commit;

