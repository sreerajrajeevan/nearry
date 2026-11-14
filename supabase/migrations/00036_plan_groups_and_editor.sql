-- Plan groups derive membership from approved participation, never a second roster.
begin;
alter table public.posts add column plan_details jsonb not null default '{}';
create function valid_plan_details(v jsonb) returns boolean as $$
 select coalesce(jsonb_typeof(v)='object' and not exists(select 1 from jsonb_object_keys(v) k where k not in ('activity','durationMinutes','level','venueBooked','costMode','ageMin','ageMax','totalCostCents'))
 and (not v?'activity' or v->>'activity' in ('gym','football','badminton','cricket','running','cycling','tennis','coffee','food','movies','walk','other'))
 and (not v?'durationMinutes' or jsonb_typeof(v->'durationMinutes')='number' and (v->>'durationMinutes')::numeric in (30,60,90,120,180,240))
 and (not v?'level' or v->>'level' in ('any','beginner','intermediate','advanced'))
 and (not v?'venueBooked' or jsonb_typeof(v->'venueBooked')='boolean')
 and (not v?'costMode' or v->>'costMode' in ('free','split','person'))
 and (not v?'ageMin' or jsonb_typeof(v->'ageMin')='number' and (v->>'ageMin')::numeric between 18 and 100 and (v->>'ageMin')::numeric=trunc((v->>'ageMin')::numeric))
 and (not v?'ageMax' or jsonb_typeof(v->'ageMax')='number' and (v->>'ageMax')::numeric between 18 and 100 and (v->>'ageMax')::numeric=trunc((v->>'ageMax')::numeric))
 and coalesce((v->>'ageMin')::numeric,18)<=coalesce((v->>'ageMax')::numeric,100)
 and (not v?'totalCostCents' or jsonb_typeof(v->'totalCostCents')='number' and (v->>'totalCostCents')::numeric between 0 and 100000000 and (v->>'totalCostCents')::numeric=trunc((v->>'totalCostCents')::numeric)),false);
$$ language sql immutable set search_path=public,pg_temp;
alter table posts add constraint post_plan_details_valid check(valid_plan_details(plan_details));
grant insert(plan_details),update(plan_details) on posts to authenticated;
create function guard_plan_details() returns trigger as $$
begin
 if tg_op='UPDATE' and new.plan_details is not distinct from old.plan_details then return new;end if;
 if current_setting('role',true)='authenticated' and tg_op='UPDATE' and (old.author_id is distinct from auth.uid() or old.status<>'open' or old.starts_at<=now()) then raise exception 'Only the host can edit an upcoming open plan';end if;
 if not valid_plan_details(new.plan_details) then raise exception 'Invalid plan preferences';end if;
 if tg_op='UPDATE' and exists(select 1 from join_requests r where r.post_id=new.id and r.status='approved') and
 (coalesce((new.plan_details->>'ageMin')::int,18)>coalesce((old.plan_details->>'ageMin')::int,18) or coalesce((new.plan_details->>'ageMax')::int,100)<coalesce((old.plan_details->>'ageMax')::int,100)) then raise exception 'The age range cannot be narrowed after members are approved';end if;
 return new;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
create trigger guard_plan_details before insert or update of plan_details on posts for each row execute function guard_plan_details();
create function plan_age_eligibility() returns trigger as $$
declare details jsonb; age int;
begin
 if new.status not in ('pending','approved') then return new;end if;
 select plan_details into details from posts where id=new.post_id;
 select p.age into age from profiles p where p.id=new.requester_id;
 if age<coalesce((details->>'ageMin')::int,18) or age>coalesce((details->>'ageMax')::int,100) then
  if tg_op='UPDATE' and old.status='full' and new.status='pending' then new.status='declined';return new;end if;
  raise exception 'Your age is outside this plan’s age range';
 end if;
 return new;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
create trigger plan_age_eligibility before insert or update of status on join_requests for each row execute function plan_age_eligibility();
create or replace view public.post_cards with (security_invoker=true) as
 select p.id,p.author_id,p.title,p.description,p.venue_id,p.venue_name,p.starts_at,p.vacancies,p.tags,p.status,p.created_at,
 p.expires_at,p.cost_cents,pr.display_name as author_name,public.approved_join_count(p.id) as approved_count,p.gender_preference,
 case when p.location_source<>'google' or p.location_cached_at>now()-interval '29 days' then p.location_lat end as location_lat,
 case when p.location_source<>'google' or p.location_cached_at>now()-interval '29 days' then p.location_lng end as location_lng,
 p.location_source,p.location_place_id,p.location_cached_at,p.plan_details
 from public.posts p join public.profiles pr on pr.id=p.author_id;

create table plan_groups(id uuid primary key default gen_random_uuid(),post_id uuid not null unique references posts(id) on delete cascade,name text not null check(char_length(btrim(name)) between 2 and 80),custom_name boolean not null default false,created_at timestamptz not null default now());
create table plan_group_messages(id uuid primary key default gen_random_uuid(),seq bigint generated always as identity unique,group_id uuid not null references plan_groups(id) on delete cascade,sender_id uuid not null references profiles(id) on delete cascade,body text not null check(char_length(btrim(body)) between 1 and 2000),client_key text not null check(char_length(client_key) between 8 and 100),created_at timestamptz not null default clock_timestamp(),unique(group_id,sender_id,client_key));
create index plan_group_memberships on join_requests(requester_id,post_id) where status='approved';
create index plan_groups_hosted on posts(author_id,created_at desc);
create index plan_group_sender_rate on plan_group_messages(sender_id,created_at desc);
create index plan_group_message_page on plan_group_messages(group_id,seq desc);
create table plan_group_reads(group_id uuid not null references plan_groups(id) on delete cascade,user_id uuid not null references profiles(id) on delete cascade,last_seq bigint not null default 0,primary key(group_id,user_id));
-- Membership is derived, so old approved users and future approvals work identically.
create function plan_group_member(p_group uuid,p_user uuid) returns boolean as $$
 select coalesce(account_active(p_user) and exists(select 1 from plan_groups g join posts p on p.id=g.post_id where g.id=p_group and account_active(p.author_id) and not users_blocked(p.author_id,p_user) and content_visible('post',p.id) and (p.author_id=p_user or exists(select 1 from join_requests r where r.post_id=p.id and r.requester_id=p_user and r.status='approved'))),false);
$$ language sql stable security definer set search_path=public,pg_temp;
create function my_plan_group_member(p_group uuid) returns boolean as $$select plan_group_member(p_group,auth.uid());$$ language sql stable security definer set search_path=public,pg_temp;
alter table plan_groups enable row level security;
alter table plan_group_messages enable row level security;
alter table plan_group_reads enable row level security;
revoke all on plan_groups,plan_group_messages,plan_group_reads from public,anon,authenticated;
grant select on plan_groups,plan_group_messages to authenticated;
grant all on plan_groups,plan_group_messages,plan_group_reads to service_role;
grant usage,select on sequence plan_group_messages_seq_seq to service_role;
create policy "plan members see group" on plan_groups for select using(my_plan_group_member(id));
create policy "plan members see messages" on plan_group_messages for select using(my_plan_group_member(group_id) and visible_author(sender_id) and content_visible('plan_message',id));
create function sync_plan_group() returns trigger as $$
begin
 if tg_op='INSERT' then insert into plan_groups(post_id,name) values(new.id,new.title) on conflict(post_id) do nothing;
 elsif new.title is distinct from old.title then update plan_groups set name=new.title where post_id=new.id and not custom_name;end if;
 return new;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
create trigger sync_plan_group after insert or update of title on posts for each row execute function sync_plan_group();
insert into plan_groups(post_id,name) select id,title from posts on conflict(post_id) do nothing;

create function get_plan_group(p_group_id uuid default null,p_post_id uuid default null,p_message_id uuid default null) returns jsonb as $$
declare g plan_groups; p posts; result jsonb;
begin
 if num_nonnulls(p_group_id,p_post_id,p_message_id)<>1 then raise exception 'Choose one plan group';end if;
 select * into g from plan_groups where (id=p_group_id or post_id=p_post_id or id=(select group_id from plan_group_messages where id=p_message_id));
 if not found or not plan_group_member(g.id,auth.uid()) then raise exception 'This group is only for the host and approved plan members';end if;
 select * into p from posts where id=g.post_id;
 select jsonb_build_object('id',g.id,'postId',g.post_id,'name',g.name,'hostId',p.author_id,'planTitle',p.title,'cancelled',p.status='cancelled','memberCount',1+approved_join_count(p.id),'members',coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',m.display_name,'host',m.id=p.author_id) order by m.id=p.author_id desc,m.display_name),'[]')) into result
 from profiles m where (m.id=p.author_id or exists(select 1 from join_requests r where r.post_id=p.id and r.requester_id=m.id and r.status='approved')) and account_active(m.id) and not users_blocked(m.id,auth.uid());
 return result;
end;
$$ language plpgsql stable security definer set search_path=public,pg_temp;
create function list_my_plan_groups() returns jsonb as $$
 select coalesce(jsonb_agg(item order by sort_at desc),'[]') from (
 select jsonb_build_object('id',g.id,'postId',g.post_id,'name',g.name,'hostId',p.author_id,'planTitle',p.title,'cancelled',p.status='cancelled','memberCount',1+approved_join_count(p.id),'lastBody',last_msg.body,'lastAt',last_msg.created_at,'unreadCount',(select count(*) from plan_group_messages m where m.group_id=g.id and m.sender_id<>auth.uid() and m.seq>coalesce(rd.last_seq,0) and visible_author(m.sender_id) and content_visible('plan_message',m.id))) item,coalesce(last_msg.created_at,g.created_at) sort_at
 from plan_groups g join posts p on p.id=g.post_id left join plan_group_reads rd on rd.group_id=g.id and rd.user_id=auth.uid()
 left join lateral(select m.body,m.created_at from plan_group_messages m where m.group_id=g.id and visible_author(m.sender_id) and content_visible('plan_message',m.id) order by m.seq desc limit 1) last_msg on true
 where g.post_id in(select id from posts where author_id=auth.uid() union select post_id from join_requests where requester_id=auth.uid() and status='approved') and plan_group_member(g.id,auth.uid()) order by coalesce(last_msg.created_at,g.created_at) desc limit 200) rows;
$$ language sql stable security definer set search_path=public,pg_temp;
create function rename_plan_group(p_group_id uuid,p_name text) returns void as $$
declare pid uuid; owner uuid;
begin
 select post_id into pid from plan_groups where id=p_group_id;
 select author_id into owner from posts where id=pid for update;
 if owner is distinct from auth.uid() or not plan_group_member(p_group_id,auth.uid()) then raise exception 'Only the host can rename this group';end if;
 if p_name is null or char_length(btrim(p_name)) not between 2 and 80 then raise exception 'Use a group name between 2 and 80 characters';end if;
 update plan_groups set name=btrim(p_name),custom_name=true where id=p_group_id;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
create function leave_plan_group(p_group_id uuid) returns void as $$
declare pid uuid; owner uuid; request_id uuid;
begin
 select post_id into pid from plan_groups where id=p_group_id;
 select author_id into owner from posts where id=pid for update;
 if auth.uid() is null or owner is null then raise exception 'Group unavailable';end if;
 if owner=auth.uid() then raise exception 'The host cannot leave their own plan. Cancel the plan instead.';end if;
 select id into request_id from join_requests where post_id=pid and requester_id=auth.uid() and status in ('approved','withdrawn') for update;
 if request_id is null then raise exception 'You are not an approved member';end if;
 perform withdraw_join_request(request_id);
 -- Existing withdrawal trigger reopens full, upcoming plans and releases capacity.
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
create function send_plan_group_message(p_group_id uuid,p_body text,p_client_key text) returns jsonb as $$
declare pid uuid; p posts; m plan_group_messages; result jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 -- Serialize a sender across groups without locking profile/FK rows.
 perform pg_advisory_xact_lock(hashtextextended('nearry-plan-chat:'||auth.uid()::text,0));
 select post_id into pid from plan_groups where id=p_group_id;
 select * into p from posts where id=pid for update;
 if not plan_group_member(p_group_id,auth.uid()) then raise exception 'You are no longer in this plan group';end if;
 if p.status='cancelled' then raise exception 'This plan was cancelled. The group is read-only.';end if;
 if p_body is null or char_length(btrim(p_body)) not between 1 and 2000 or p_client_key is null or char_length(p_client_key) not between 8 and 100 then raise exception 'Write a message under 2000 characters';end if;
 select * into m from plan_group_messages where group_id=p_group_id and sender_id=auth.uid() and client_key=p_client_key;
 if found then
  if m.body<>btrim(p_body) then raise exception 'This retry key belongs to a different message';end if;
  return to_jsonb(m)||jsonb_build_object('sender_name',(select display_name from profiles where id=m.sender_id));
 end if;
 if (select count(*) from plan_group_messages where sender_id=auth.uid() and created_at>clock_timestamp()-interval '1 minute')>=30 then raise exception 'Please wait a moment before sending more messages';end if;
 insert into plan_group_messages(group_id,sender_id,body,client_key) values(p_group_id,auth.uid(),btrim(p_body),p_client_key) on conflict(group_id,sender_id,client_key) do nothing returning * into m;
 if m.id is null then select * into m from plan_group_messages where group_id=p_group_id and sender_id=auth.uid() and client_key=p_client_key; if m.body<>btrim(p_body) then raise exception 'This retry key belongs to a different message';end if;end if;
 return to_jsonb(m)||jsonb_build_object('sender_name',(select display_name from profiles where id=m.sender_id));
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
create function mark_plan_group_read(p_group_id uuid,p_last_message_id uuid) returns void as $$
declare boundary bigint;
begin
 if not plan_group_member(p_group_id,auth.uid()) then raise exception 'Group unavailable';end if;
 select seq into boundary from plan_group_messages where id=p_last_message_id and group_id=p_group_id and visible_author(sender_id) and content_visible('plan_message',id);
 if boundary is null then raise exception 'Message unavailable';end if;
 insert into plan_group_reads values(p_group_id,auth.uid(),boundary) on conflict(group_id,user_id) do update set last_seq=greatest(plan_group_reads.last_seq,excluded.last_seq);
 update notifications set read_at=clock_timestamp() where user_id=auth.uid() and kind='plan_group_message' and read_at is null and ref_id in(select id from plan_group_messages where group_id=p_group_id and seq<=boundary);
end;
$$ language plpgsql security definer set search_path=public,pg_temp;

-- Reuse the existing delivery, preference and moderation pipelines.
alter table notifications drop constraint notifications_kind_check;
alter table notifications add constraint notifications_kind_check check(kind in ('join_request','request_approved','request_declined','request_full','post_cancelled','booking','booking_confirmed','booking_cancelled','message','verification_approved','verification_rejected','selfie_review','plan_group_message'));
create function notify_plan_group_message() returns trigger as $$
begin
 insert into notifications(user_id,kind,title,body,ref_id,created_at)
 select m.id,'plan_group_message',g.name,left(new.body,140),new.id,new.created_at
 from plan_groups g join posts p on p.id=g.post_id join profiles m on (m.id=p.author_id or exists(select 1 from join_requests r where r.post_id=p.id and r.requester_id=m.id and r.status='approved'))
 where g.id=new.group_id and m.id<>new.sender_id and plan_group_member(g.id,m.id) and not users_blocked(m.id,new.sender_id);
 return new;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
create trigger notify_plan_group_message after insert on plan_group_messages for each row execute function notify_plan_group_message();
create function clean_plan_group_notices() returns trigger as $$begin delete from notifications where kind='plan_group_message' and ref_id=old.id;return old;end;$$ language plpgsql security definer set search_path=public,pg_temp;
create trigger clean_plan_group_notices after delete on plan_group_messages for each row execute function clean_plan_group_notices();
do $copy$begin execute replace(pg_get_functiondef('notification_allowed(uuid,text,uuid)'::regprocedure),'FUNCTION public.notification_allowed(', 'FUNCTION public.notification_allowed_before_plan_groups(');end$copy$;
create or replace function notification_allowed(p_user uuid,p_kind text,p_ref uuid) returns boolean as $$
 select case when p_kind='plan_group_message' then exists(select 1 from plan_group_messages m where m.id=p_ref and plan_group_member(m.group_id,p_user) and account_active(m.sender_id) and not users_blocked(m.sender_id,p_user) and content_visible('plan_message',m.id)) else notification_allowed_before_plan_groups(p_user,p_kind,p_ref) end;
$$ language sql stable security definer set search_path=public,pg_temp;
-- Preserve dispatcher OIDs so existing callers and notice RLS use the new checks.
create or replace function my_notification_visible(p_kind text,p_ref uuid) returns boolean as $$ select notification_allowed(auth.uid(),p_kind,p_ref);$$ language sql stable security definer set search_path=public,pg_temp;
do $copy$begin execute replace(pg_get_functiondef('unread_counts()'::regprocedure),'FUNCTION public.unread_counts(', 'FUNCTION public.unread_counts_before_plan_groups(');end$copy$;
create or replace function unread_counts() returns jsonb as $$
 declare result jsonb; n bigint; notices bigint;
 begin
 result=unread_counts_before_plan_groups();
 with eligible as materialized (
  select g.id from plan_groups g where g.post_id in(select id from posts where author_id=auth.uid() union select post_id from join_requests where requester_id=auth.uid() and status='approved') and plan_group_member(g.id,auth.uid())
 ) select count(*) into n from eligible g join plan_group_messages m on m.group_id=g.id left join plan_group_reads r on r.group_id=g.id and r.user_id=auth.uid() where m.sender_id<>auth.uid() and m.seq>coalesce(r.last_seq,0) and visible_author(m.sender_id) and content_visible('plan_message',m.id);
 select count(*) into notices from notifications where user_id=auth.uid() and read_at is null and kind='plan_group_message' and notification_allowed(auth.uid(),kind,ref_id);
 -- Group message notices contribute to Messages once, not again to Activity.
 return result||jsonb_build_object('messages',(result->>'messages')::bigint+n,'other_notifications',greatest(0,(result->>'other_notifications')::bigint-notices));
 end;
$$ language plpgsql stable security definer set search_path=public,pg_temp;
alter table content_reports drop constraint content_reports_target_kind_check;
alter table content_reports add constraint content_reports_target_kind_check check(target_kind in ('post','photo','offer','venue','user','message','conversation','plan_message'));
do $copy$begin execute replace(pg_get_functiondef('submit_content_report(text,uuid,text,text)'::regprocedure),'FUNCTION public.submit_content_report(', 'FUNCTION public.submit_content_report_before_plan_groups(');end$copy$;
create or replace function submit_content_report(p_kind text,p_target uuid,p_reason text,p_details text default '') returns uuid as $$
declare m plan_group_messages; rid uuid;
begin
 if p_kind<>'plan_message' then return submit_content_report_before_plan_groups(p_kind,p_target,p_reason,p_details);end if;
 if not account_active(auth.uid()) then raise exception 'Account unavailable';end if;
 if p_reason is null or p_reason not in ('spam','harassment','inappropriate','scam','safety','other') or char_length(coalesce(p_details,''))>1000 then raise exception 'Invalid report';end if;
 perform 1 from profiles where id=auth.uid() for update;
 select * into m from plan_group_messages where id=p_target;
 if not found or not plan_group_member(m.group_id,auth.uid()) then raise exception 'Message unavailable';end if;
 if m.sender_id=auth.uid() then raise exception 'You cannot report your own message';end if;
 select id into rid from content_reports where reporter_id=auth.uid() and target_kind=p_kind and target_id=p_target;
 if rid is not null then return rid;end if;
 if (select count(*) from content_reports where reporter_id=auth.uid() and created_at>now()-interval '1 day')>=20 then raise exception 'Daily report limit reached';end if;
 insert into content_reports(reporter_id,subject_user_id,target_kind,target_id,reason,details,snapshot) values(auth.uid(),m.sender_id,p_kind,p_target,p_reason,btrim(coalesce(p_details,'')),'Plan group '||m.group_id::text||E'\n'||m.body) returning id into rid;
 return rid;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
do $copy$begin execute replace(pg_get_functiondef('review_content_report(uuid,text,text)'::regprocedure),'FUNCTION public.review_content_report(', 'FUNCTION public.review_content_report_before_plan_groups(');end$copy$;
create or replace function review_content_report(p_report uuid,p_action text,p_note text default '') returns void as $$
declare r content_reports;
begin
 select * into r from content_reports where id=p_report for update;
 if r.target_kind is distinct from 'plan_message' or p_action is distinct from 'remove' then perform review_content_report_before_plan_groups(p_report,p_action,p_note);return;end if;
 if r.status<>'open' or char_length(coalesce(p_note,''))>1000 then raise exception 'Report unavailable';end if;
 insert into removed_content(target_kind,target_id) values('plan_message',r.target_id) on conflict do nothing;
 delete from plan_group_messages where id=r.target_id;
 update content_reports set status='resolved',reviewed_at=now(),review_note=btrim(coalesce(p_note,'')) where id=r.id;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;

revoke all on function valid_plan_details(jsonb),guard_plan_details(),plan_age_eligibility(),sync_plan_group(),notify_plan_group_message(),clean_plan_group_notices(),plan_group_member(uuid,uuid) from public,anon,authenticated;
-- CHECK evaluation needs this pure, non-sensitive validator.
grant execute on function valid_plan_details(jsonb) to authenticated,service_role;
revoke all on function my_plan_group_member(uuid),get_plan_group(uuid,uuid,uuid),list_my_plan_groups(),rename_plan_group(uuid,text),leave_plan_group(uuid),send_plan_group_message(uuid,text,text),mark_plan_group_read(uuid,uuid),unread_counts(),submit_content_report(text,uuid,text,text) from public,anon;
grant execute on function my_plan_group_member(uuid),get_plan_group(uuid,uuid,uuid),list_my_plan_groups(),rename_plan_group(uuid,text),leave_plan_group(uuid),send_plan_group_message(uuid,text,text),mark_plan_group_read(uuid,uuid),unread_counts(),submit_content_report(text,uuid,text,text) to authenticated;
revoke all on function notification_allowed(uuid,text,uuid),review_content_report(uuid,text,text) from public,anon,authenticated;
grant execute on function notification_allowed(uuid,text,uuid),review_content_report(uuid,text,text) to service_role;
-- Preserved implementations must not become alternate client entry points.
revoke all on function notification_allowed_before_plan_groups(uuid,text,uuid),unread_counts_before_plan_groups(),submit_content_report_before_plan_groups(text,uuid,text,text),review_content_report_before_plan_groups(uuid,text,text) from public,anon,authenticated;
grant execute on function notification_allowed_before_plan_groups(uuid,text,uuid),unread_counts_before_plan_groups(),submit_content_report_before_plan_groups(text,uuid,text,text),review_content_report_before_plan_groups(uuid,text,text) to service_role;
do $$begin if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table plan_group_messages;end if;end$$;
notify pgrst,'reload schema';
commit;
