begin;
alter table profiles add column if not exists terms_version text;
alter table profiles add column if not exists terms_accepted_at timestamptz;
alter table profiles add column if not exists suspended_at timestamptz;
alter table profiles add column if not exists deletion_requested_at timestamptz;
alter table profiles add column if not exists push_enabled boolean not null default true;

create table user_blocks (
 blocker_id uuid not null references profiles(id) on delete cascade,
 blocked_id uuid not null references profiles(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id)
);
create index user_blocks_reverse on user_blocks(blocked_id,blocker_id);
alter table user_blocks enable row level security;
revoke all on user_blocks from public,anon,authenticated;
grant select on user_blocks to authenticated;
create policy "own blocks" on user_blocks for select using(blocker_id=auth.uid());

create table content_reports (
 id uuid primary key default gen_random_uuid(),reporter_id uuid references profiles(id) on delete cascade,
 subject_user_id uuid references profiles(id) on delete cascade,
 target_kind text not null check(target_kind in ('post','photo','offer','venue','user','message')),
 target_id uuid not null,reason text not null check(reason in ('spam','harassment','inappropriate','scam','safety','other')),
 details text not null default '' check(char_length(details)<=1000),snapshot text not null default '',
 status text not null default 'open' check(status in ('open','resolved','dismissed')),
 created_at timestamptz not null default now(),reviewed_at timestamptz,review_note text,
 unique(reporter_id,target_kind,target_id)
);
alter table content_reports enable row level security;
revoke all on content_reports from public,anon,authenticated;
grant select(id,target_kind,target_id,reason,details,status,created_at,reviewed_at) on content_reports to authenticated;
grant all on content_reports,user_blocks to service_role;
create policy "reporters read own reports" on content_reports for select using(reporter_id=auth.uid());
create index reports_queue on content_reports(created_at) where status='open';
create table removed_content(target_kind text not null,target_id uuid not null,removed_at timestamptz not null default now(),primary key(target_kind,target_id));
alter table removed_content enable row level security;
revoke all on removed_content from public,anon,authenticated;
grant all on removed_content to service_role;

create or replace function account_active(p_user uuid) returns boolean as $$
 select exists(select 1 from profiles where id=p_user and suspended_at is null and deletion_requested_at is null);
$$ language sql stable security definer set search_path=public;
create or replace function users_blocked(p_a uuid,p_b uuid) returns boolean as $$
 select exists(select 1 from user_blocks where (blocker_id=p_a and blocked_id=p_b) or (blocker_id=p_b and blocked_id=p_a));
$$ language sql stable security definer set search_path=public;
create or replace function content_visible(p_kind text,p_id uuid) returns boolean as $$
 select not exists(select 1 from removed_content where target_kind=p_kind and target_id=p_id);
$$ language sql stable security definer set search_path=public;
revoke all on function account_active(uuid),users_blocked(uuid,uuid),content_visible(text,uuid) from public,anon,authenticated;
-- Boolean helpers disclose no private profile fields or block direction.
grant execute on function account_active(uuid),content_visible(text,uuid) to anon,authenticated,service_role;
-- Restrict arbitrary-pair probes to one's own pair.
create or replace function can_interact_with(p_other uuid) returns boolean as $$
 select account_active(auth.uid()) and account_active(p_other) and not users_blocked(auth.uid(),p_other);
$$ language sql stable security definer set search_path=public;
revoke all on function can_interact_with(uuid) from public,anon;
grant execute on function can_interact_with(uuid) to authenticated,service_role;
create or replace function visible_author(p_author uuid) returns boolean as $$
 select account_active(p_author) and (auth.uid() is null or not users_blocked(auth.uid(),p_author));
$$ language sql stable security definer set search_path=public;
revoke all on function visible_author(uuid) from public;
grant execute on function visible_author(uuid) to anon,authenticated,service_role;

create function my_offer_booking(p_offer uuid) returns boolean as $$
 select exists(select 1 from bookings where offer_id=p_offer and customer_id=auth.uid());
$$ language sql stable security definer set search_path=public;
revoke all on function my_offer_booking(uuid) from public;
grant execute on function my_offer_booking(uuid) to anon,authenticated,service_role;
create policy "safety post visibility" on posts as restrictive for select using(author_id=auth.uid() or (visible_author(author_id) and content_visible('post',id)));
create policy "safety offer visibility" on offers as restrictive for select using(business_id=auth.uid() or (visible_author(business_id) and content_visible('offer',id)) or my_offer_booking(id));
create policy "safety venue visibility" on venues as restrictive for select using(content_visible('venue',id) and (business_id is null or visible_author(business_id)));
create policy "safety photo visibility" on post_photos as restrictive for select using(content_visible('photo',id) and exists(select 1 from posts p where p.id=post_id));
create policy "active account file updates" on storage.objects as restrictive for update using(account_active(auth.uid())) with check(account_active(auth.uid()));
create policy "active account uploads" on storage.objects as restrictive for insert with check(account_active(auth.uid()));
create policy "active account post inserts" on posts as restrictive for insert with check(account_active(auth.uid()));

create or replace function set_user_block(p_user uuid,p_blocked boolean) returns void as $$
begin
 if not account_active(auth.uid()) then raise exception 'account unavailable';end if;
 if p_user is null or p_user=auth.uid() or not exists(select 1 from profiles where id=p_user) then raise exception 'invalid user';end if;
 if p_blocked is null then raise exception 'invalid block state';end if;
 if p_blocked then
  insert into user_blocks(blocker_id,blocked_id) values(auth.uid(),p_user) on conflict do nothing;
 else delete from user_blocks where blocker_id=auth.uid() and blocked_id=p_user;end if;
end;
$$ language plpgsql security definer set search_path=public;
create or replace function list_blocked_users() returns jsonb as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'created_at',b.created_at) order by b.created_at desc),'[]')
 from user_blocks b join profiles p on p.id=b.blocked_id where b.blocker_id=auth.uid();
$$ language sql stable security definer set search_path=public;

create or replace function submit_content_report(p_kind text,p_target uuid,p_reason text,p_details text default '') returns uuid as $$
declare subject uuid; summary text; rid uuid;begin
 if not account_active(auth.uid()) then raise exception 'account unavailable';end if;
 if p_reason is null or p_reason not in ('spam','harassment','inappropriate','scam','safety','other') or char_length(coalesce(p_details,''))>1000 then raise exception 'invalid report';end if;
 -- A per-reporter lock serializes limits and repeat submissions.
 perform 1 from profiles where id=auth.uid() for update;
 select id into rid from content_reports where reporter_id=auth.uid() and target_kind=p_kind and target_id=p_target;
 if rid is not null then return rid;end if;
 if (select count(*) from content_reports where reporter_id=auth.uid() and created_at>now()-interval '1 day')>=20 then raise exception 'Daily report limit reached. Please contact support for urgent concerns.';end if;
 if p_kind='post' then select author_id,left(title||E'\n'||description,2000) into subject,summary from posts where id=p_target;
 elsif p_kind='photo' then select p.author_id,left(p.title||E'\n'||f.photo_url,2000) into subject,summary from post_photos f join posts p on p.id=f.post_id where f.id=p_target;
 elsif p_kind='offer' then select business_id,left(title||E'\n'||description,2000) into subject,summary from offers where id=p_target;
 elsif p_kind='venue' then select business_id,name into subject,summary from venues where id=p_target;
 elsif p_kind='user' then select id,display_name into subject,summary from profiles where id=p_target;
 elsif p_kind='message' then
  select m.sender_id,left(m.body,2000) into subject,summary from messages m join conversations c on c.id=m.conversation_id
   where m.id=p_target and auth.uid() in(c.user_a,c.user_b);
 else raise exception 'invalid report target';end if;
 if summary is null then raise exception 'Content not found or not accessible';end if;
 if subject=auth.uid() then raise exception 'You cannot report your own content';end if;
 insert into content_reports(reporter_id,subject_user_id,target_kind,target_id,reason,details,snapshot)
 values(auth.uid(),subject,p_kind,p_target,p_reason,btrim(coalesce(p_details,'')),summary) returning id into rid;
 return rid;
end;
$$ language plpgsql security definer set search_path=public;

create or replace function enforce_safety_interaction() returns trigger as $$
declare a uuid;b uuid;cid uuid;begin
 if tg_table_name='messages' then
  select user_a,user_b into a,b from conversations where id=new.conversation_id;
 elsif tg_table_name='conversations' then a:=new.user_a;b:=new.user_b;
 elsif tg_table_name='join_requests' then
  if new.status not in ('pending','approved') then return new;end if;
  if tg_op='UPDATE' and new.status is not distinct from old.status then return new;end if;
  select author_id into a from posts where id=new.post_id;b:=new.requester_id;
  if not content_visible('post',new.post_id) then raise exception 'Plan unavailable';end if;
 elsif tg_table_name='bookings' then
  if new.status not in ('pending','confirmed') then return new;end if;
  if tg_op='UPDATE' and new.status is not distinct from old.status then return new;end if;
  select business_id into a from offers where id=new.offer_id;b:=new.customer_id;
  if not content_visible('offer',new.offer_id) then raise exception 'Offer unavailable';end if;
 end if;
 if a is null or b is null or not account_active(a) or not account_active(b) or users_blocked(a,b) then raise exception 'Interaction unavailable. This account is blocked or inactive.';end if;
 return new;
end;
$$ language plpgsql security definer set search_path=public;
create trigger safety_messages before insert on messages for each row execute function enforce_safety_interaction();
create trigger safety_conversations before insert on conversations for each row execute function enforce_safety_interaction();
create trigger safety_joins before insert or update on join_requests for each row execute function enforce_safety_interaction();
create trigger safety_bookings before insert or update on bookings for each row execute function enforce_safety_interaction();
-- Existing security-definer RPCs must also enforce inactive-account restrictions.
create or replace function safety_owner_write() returns trigger as $$
declare owner_id uuid;begin
 if tg_table_name='posts' then owner_id:=new.author_id;else owner_id:=new.business_id;end if;
 if (tg_op='INSERT' or current_user in ('authenticated','anon')) and not account_active(owner_id) then raise exception 'Account unavailable';end if;
 if tg_table_name='offers' and new.status='live' and not account_active(owner_id) then raise exception 'Account unavailable';end if;
 return new;
end;
$$ language plpgsql;
create trigger safety_posts_write before insert or update on posts for each row execute function safety_owner_write();
create trigger safety_offers_write before insert or update on offers for each row execute function safety_owner_write();

create or replace function conversation_safety(p_conversation uuid) returns jsonb as $$
 select jsonb_build_object('userId',p.id,'name',p.display_name,'canMessage',account_active(c.user_a) and account_active(c.user_b) and not users_blocked(c.user_a,c.user_b),
 'blockedByMe',exists(select 1 from user_blocks where blocker_id=auth.uid() and blocked_id=p.id))
 from conversations c join profiles p on p.id=case when c.user_a=auth.uid() then c.user_b else c.user_a end
 where c.id=p_conversation and auth.uid() in(c.user_a,c.user_b);
$$ language sql stable security definer set search_path=public;

create table media_cleanup_jobs (
 id uuid primary key default gen_random_uuid(),bucket text not null check(bucket='photos'),path text not null unique,
 attempts int not null default 0,next_attempt_at timestamptz not null default now(),last_error text
);
alter table media_cleanup_jobs enable row level security;
revoke all on media_cleanup_jobs from public,anon,authenticated;
grant all on media_cleanup_jobs to service_role;
create function claim_media_cleanup() returns setof media_cleanup_jobs as $$
 with due as(select id from media_cleanup_jobs where next_attempt_at<=now() and attempts<20 order by next_attempt_at for update skip locked limit 100)
 update media_cleanup_jobs j set attempts=j.attempts+1,next_attempt_at=now()+interval '10 minutes' from due where j.id=due.id returning j.*;
$$ language sql security definer set search_path=public;
revoke all on function claim_media_cleanup() from public,anon,authenticated;
grant execute on function claim_media_cleanup() to service_role;

create function cancel_account_commitments(p_user uuid) returns void as $$
begin
 if p_user is distinct from auth.uid() then
  insert into notifications(user_id,kind,title,body,ref_id)
  select distinct o.business_id,'booking_cancelled','Booking cancelled','An account is no longer available. Review your bookings.',o.id
  from bookings b join offers o on o.id=b.offer_id where b.customer_id=p_user and b.status in ('pending','confirmed') and b.slot>now();
 end if;
 update posts set status='cancelled' where author_id=p_user and status<>'cancelled';
 update offers set status='ended' where business_id=p_user and status<>'ended';
 update bookings set status='cancelled' where status in ('pending','confirmed') and slot>now()
  and (customer_id=p_user or offer_id in(select id from offers where business_id=p_user));
 update join_requests set status='withdrawn' where requester_id=p_user and status in ('pending','approved');
 delete from push_tokens where user_id=p_user;
end;
$$ language plpgsql security definer set search_path=public;
revoke all on function cancel_account_commitments(uuid) from public,anon,authenticated;
grant execute on function cancel_account_commitments(uuid) to service_role;

-- Only trusted service operators can inspect all reports or take action.
create or replace function review_content_report(p_report uuid,p_action text,p_note text default '') returns void as $$
declare r content_reports; photo_url text; object_path text;begin
 if p_action is null or p_action not in ('dismiss','remove','suspend') or char_length(coalesce(p_note,''))>1000 then raise exception 'Invalid review';end if;
 select * into r from content_reports where id=p_report for update;
 if not found or r.status<>'open' then raise exception 'Report already reviewed or unavailable';end if;
 if p_action='suspend' then
  if r.subject_user_id is null then raise exception 'No account to suspend';end if;
  perform cancel_account_commitments(r.subject_user_id);
  update profiles set suspended_at=now() where id=r.subject_user_id;
 elsif p_action='remove' then
  if r.target_kind='user' then raise exception 'Use suspend for an account';end if;
  insert into removed_content(target_kind,target_id) values(r.target_kind,r.target_id) on conflict do nothing;
  if r.target_kind='post' then update posts set status='cancelled' where id=r.target_id;
  elsif r.target_kind='offer' then
   update offers set status='ended' where id=r.target_id;
   update bookings set status='cancelled' where offer_id=r.target_id and status in ('pending','confirmed') and slot>now();
  elsif r.target_kind='photo' then
   select f.photo_url into photo_url from post_photos f where f.id=r.target_id;
   object_path:=split_part(split_part(photo_url,'/storage/v1/object/public/photos/',2),'?',1);
   if object_path<>'' and split_part(object_path,'/',1)=r.subject_user_id::text then
    insert into media_cleanup_jobs(bucket,path) values('photos',object_path) on conflict do nothing;
   end if;
   delete from post_photos where id=r.target_id;
  elsif r.target_kind='message' then delete from messages where id=r.target_id;
  end if;
 end if;
 update content_reports set status=case when p_action='dismiss' then 'dismissed' else 'resolved' end,reviewed_at=now(),review_note=btrim(coalesce(p_note,'')) where id=r.id;
end;
$$ language plpgsql security definer set search_path=public;
revoke all on function review_content_report(uuid,text,text) from public,anon,authenticated;
grant execute on function review_content_report(uuid,text,text) to service_role;
revoke all on function set_user_block(uuid,boolean),list_blocked_users(),submit_content_report(text,uuid,text,text),conversation_safety(uuid) from public,anon;
grant execute on function set_user_block(uuid,boolean),list_blocked_users(),submit_content_report(text,uuid,text,text),conversation_safety(uuid) to authenticated;

-- Idempotent deletion request. Files are removed through Storage API before Auth.
create table account_deletion_jobs (
 user_id uuid primary key,requested_at timestamptz not null default now(),attempts int not null default 0,
 next_attempt_at timestamptz not null default now(),lease_id uuid,last_error text,prepared_at timestamptz
);
alter table account_deletion_jobs enable row level security;
revoke all on account_deletion_jobs from public,anon,authenticated;
grant all on account_deletion_jobs to service_role;
create function queue_account_deletion(p_user uuid) returns void as $$
begin
 perform 1 from profiles where id=p_user for update;
 if not found then raise exception 'Account unavailable';end if;
 if exists(select 1 from account_deletion_jobs where user_id=p_user) then return;end if;
 perform cancel_account_commitments(p_user);
 update profiles set deletion_requested_at=now() where id=p_user;
 insert into account_deletion_jobs(user_id) values(p_user) on conflict do nothing;
end;
$$ language plpgsql security definer set search_path=public;
revoke all on function queue_account_deletion(uuid) from public,anon,authenticated;
-- Trusted support may call this ONLY after verifying the registered owner.
grant execute on function queue_account_deletion(uuid) to service_role;
create or replace function request_account_deletion(p_confirmation text) returns void as $$
begin
 if auth.uid() is null or p_confirmation is distinct from 'DELETE' then raise exception 'Type DELETE to confirm';end if;
 perform queue_account_deletion(auth.uid());
end;
$$ language plpgsql security definer set search_path=public;
create or replace function claim_account_deletions() returns setof account_deletion_jobs as $$
 with due as(select user_id from account_deletion_jobs where next_attempt_at<=now() and attempts<20 order by requested_at for update skip locked limit 10)
 update account_deletion_jobs j set attempts=j.attempts+1,next_attempt_at=now()+interval '10 minutes',lease_id=gen_random_uuid() from due where j.user_id=due.user_id returning j.*;
$$ language sql security definer set search_path=public;
create or replace function deletion_storage_batch(p_user uuid) returns jsonb as $$
 select coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'path',name)),'[]') from
 (select bucket_id,name from storage.objects where split_part(name,'/',1)=p_user::text order by bucket_id,name limit 100) files;
$$ language sql security definer set search_path=public;
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
  or (kind in ('join_request','request_approved','request_declined','post_cancelled') and ref_id in(select id from posts where author_id=p_user))
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
revoke all on function request_account_deletion(text) from public,anon;
grant execute on function request_account_deletion(text) to authenticated;
revoke all on function claim_account_deletions(),deletion_storage_batch(uuid),prepare_auth_deletion(uuid) from public,anon,authenticated;
grant execute on function claim_account_deletions(),deletion_storage_batch(uuid),prepare_auth_deletion(uuid) to service_role;
-- Restrict direct data changes by a still-valid token after deactivation.
create policy "active profile changes" on profiles as restrictive for update using(account_active(auth.uid())) with check(account_active(auth.uid()));
create policy "active photo changes" on post_photos as restrictive for all using(account_active(auth.uid())) with check(account_active(auth.uid()));
-- Public gallery reads must remain available to anonymous visitors.
-- Only writes need active ownership, so replace the all-command policy.
drop policy "active photo changes" on post_photos;
create policy "active photo inserts" on post_photos as restrictive for insert with check(account_active(auth.uid()));
create policy "active photo updates" on post_photos as restrictive for update using(account_active(auth.uid())) with check(account_active(auth.uid()));
-- Preserve context/history, but exclude blocked conversations from inbox and badges.
alter function get_or_create_conversation(uuid,uuid,uuid) rename to get_or_create_conversation_before_safety;
revoke all on function get_or_create_conversation_before_safety(uuid,uuid,uuid) from public,anon,authenticated;
create function get_or_create_conversation(p_other_user uuid,p_post_id uuid default null,p_booking_id uuid default null) returns uuid as $$
begin
 if not can_interact_with(p_other_user) then raise exception 'Interaction unavailable. This account is blocked or inactive.';end if;
 return get_or_create_conversation_before_safety(p_other_user,p_post_id,p_booking_id);
end;
$$ language plpgsql security definer set search_path=public;
revoke all on function get_or_create_conversation(uuid,uuid,uuid) from public,anon;
grant execute on function get_or_create_conversation(uuid,uuid,uuid) to authenticated;
alter function list_my_conversations() rename to list_my_conversations_before_safety;
revoke all on function list_my_conversations_before_safety() from public,anon,authenticated;
create function list_my_conversations() returns json as $$
 select coalesce(json_agg(item order by (item->>'last_at')::timestamptz desc nulls last),'[]') from json_array_elements(list_my_conversations_before_safety()) item
 where account_active(auth.uid()) and account_active((item->>'other_user_id')::uuid) and not users_blocked(auth.uid(),(item->>'other_user_id')::uuid);
$$ language sql stable security definer set search_path=public;
revoke all on function list_my_conversations() from public,anon;
grant execute on function list_my_conversations() to authenticated;
create function notification_allowed(p_user uuid,p_kind text,p_ref uuid) returns boolean as $$
 select account_active(p_user) and (p_kind<>'message' or exists(select 1 from conversations c where c.id=p_ref and p_user in(c.user_a,c.user_b) and account_active(c.user_a) and account_active(c.user_b) and not users_blocked(c.user_a,c.user_b)));
$$ language sql stable security definer set search_path=public;
revoke all on function notification_allowed(uuid,text,uuid) from public,anon,authenticated;
grant execute on function notification_allowed(uuid,text,uuid) to service_role;
create function my_notification_visible(p_kind text,p_ref uuid) returns boolean as $$
 select notification_allowed(auth.uid(),p_kind,p_ref);
$$ language sql stable security definer set search_path=public;
revoke all on function my_notification_visible(text,uuid) from public,anon;
grant execute on function my_notification_visible(text,uuid) to authenticated;
create policy "safety notification visibility" on notifications as restrictive for select using(my_notification_visible(kind,ref_id));
create or replace function unread_counts() returns jsonb as $$
 select jsonb_build_object(
 'messages',(select count(*) from messages m join conversations c on c.id=m.conversation_id
 left join conversation_reads r on r.conversation_id=c.id and r.user_id=auth.uid()
 where auth.uid() in(c.user_a,c.user_b) and m.sender_id<>auth.uid() and account_active(auth.uid())
 and account_active(c.user_a) and account_active(c.user_b) and not users_blocked(c.user_a,c.user_b) and m.created_at>coalesce(r.last_read_at,'1970-01-01'::timestamptz)),
 'notifications',(select count(*) from notifications n where user_id=auth.uid() and read_at is null and notification_allowed(auth.uid(),kind,ref_id)),
 'other_notifications',(select count(*) from notifications n where user_id=auth.uid() and kind<>'message' and read_at is null and notification_allowed(auth.uid(),kind,ref_id)));
$$ language sql stable security definer set search_path=public;
create function accept_community_terms(p_version text,p_adult boolean) returns void as $$
begin
 if not account_active(auth.uid()) or p_version is distinct from '2026-10-19' or p_adult is distinct from true then raise exception 'Please confirm your age and accept the current terms';end if;
 update profiles set terms_version=p_version,terms_accepted_at=now() where id=auth.uid();
end;
$$ language plpgsql security definer set search_path=public;
revoke all on function accept_community_terms(text,boolean) from public,anon;
grant execute on function accept_community_terms(text,boolean) to authenticated;
create function maintenance_retention_cleanup() returns void as $$
begin
 delete from content_reports where reviewed_at<now()-interval '90 days';
 delete from push_jobs where sent_at<now()-interval '30 days';
end;
$$ language plpgsql security definer set search_path=public;
revoke all on function maintenance_retention_cleanup() from public,anon,authenticated;
grant execute on function maintenance_retention_cleanup() to service_role;
-- A discovery-only view excludes blocked owners even when a past booking
-- still authorizes reading that offer through its history screen.
create view discovery_offers with (security_invoker=true) as
 select o.*,p.business_name as discovery_business_name,p.display_name as discovery_display_name
 from offers o join profiles p on p.id=o.business_id
 where visible_author(o.business_id) and content_visible('offer',o.id);
grant select on discovery_offers to anon,authenticated;
commit;
