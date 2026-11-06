-- Member-specific chat deletion. Shared messages are preserved for the other member.
begin;
create table conversation_clears (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  cleared_at timestamptz not null,
  primary key(conversation_id,user_id)
);
alter table conversation_clears enable row level security;
revoke all on conversation_clears from public,anon,authenticated;
grant select on conversation_clears to authenticated;
grant all on conversation_clears to service_role;
create policy "own conversation clears" on conversation_clears for select using(user_id=auth.uid());

-- The boundary is server-owned; direct message reads cannot restore cleared history.
create policy "uncleared messages" on messages as restrictive for select using (
  not exists(select 1 from conversation_clears d where d.conversation_id=messages.conversation_id
    and d.user_id=auth.uid() and messages.created_at<=d.cleared_at)
);
create function delete_my_conversation(p_conversation_id uuid) returns void as $$
declare cutoff timestamptz;
begin
 if not account_active(auth.uid()) then raise exception 'account unavailable';end if;
 perform 1 from conversations where id=p_conversation_id and auth.uid() in(user_a,user_b) for update;
 if not found then raise exception 'not a conversation member';end if;
 cutoff:=clock_timestamp();
 insert into conversation_clears(conversation_id,user_id,cleared_at) values(p_conversation_id,auth.uid(),cutoff)
 on conflict(conversation_id,user_id) do update set cleared_at=greatest(conversation_clears.cleared_at,excluded.cleared_at);
 insert into conversation_reads(conversation_id,user_id,last_read_at) values(p_conversation_id,auth.uid(),cutoff)
 on conflict(conversation_id,user_id) do update set last_read_at=greatest(conversation_reads.last_read_at,excluded.last_read_at);
 update notifications set read_at=cutoff where user_id=auth.uid() and kind='message'
   and ref_id=p_conversation_id and read_at is null and created_at<=cutoff;
end;
$$ language plpgsql security definer set search_path=public;
revoke all on function delete_my_conversation(uuid) from public,anon;
grant execute on function delete_my_conversation(uuid) to authenticated;

-- Filter both history and previews. A new message revives the inbox entry,
-- but never revives the deleting member's old messages.
create or replace function list_my_conversations() returns json as $$
 select coalesce(json_agg(row_to_json(t) order by t.last_at desc nulls last,t.id),'[]'::json) from (
  select c.id, p.id as other_user_id,p.display_name as other_name,c.post_id,c.booking_id,
    coalesce(post.title,offer.title) as context_title,last_msg.body as last_body,last_msg.created_at as last_at,
    (select count(*) from messages m where m.conversation_id=c.id and m.sender_id<>auth.uid()
      and m.created_at>greatest(coalesce(r.last_read_at,'1970-01-01'::timestamptz),coalesce(d.cleared_at,'1970-01-01'::timestamptz))) as unread_count
  from conversations c
  join profiles p on p.id=case when c.user_a=auth.uid() then c.user_b else c.user_a end
  left join posts post on post.id=c.post_id
  left join bookings b on b.id=c.booking_id
  left join offers offer on offer.id=b.offer_id
  left join conversation_clears d on d.conversation_id=c.id and d.user_id=auth.uid()
  left join conversation_reads r on r.conversation_id=c.id and r.user_id=auth.uid()
  left join lateral (select m.body,m.created_at from messages m where m.conversation_id=c.id
    and (d.cleared_at is null or m.created_at>d.cleared_at) order by m.created_at desc,m.id desc limit 1) last_msg on true
  where auth.uid() in(c.user_a,c.user_b) and account_active(auth.uid()) and account_active(p.id)
    and not users_blocked(auth.uid(),p.id) and (d.cleared_at is null or last_msg.created_at is not null)
 ) t;
$$ language sql stable security definer set search_path=public;
revoke all on function list_my_conversations() from public,anon;
grant execute on function list_my_conversations() to authenticated;

-- A conversation report preserves recent context for the existing moderation queue.
alter table content_reports drop constraint content_reports_target_kind_check;
alter table content_reports add constraint content_reports_target_kind_check
 check(target_kind in ('post','photo','offer','venue','user','message','conversation'));
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
 elsif p_kind='conversation' then
  select case when c.user_a=auth.uid() then c.user_b else c.user_a end,
    'Conversation '||c.id::text||E'\n'||coalesce((
      select string_agg(m.sender_id::text||' ['||m.created_at::text||'] '||m.body,E'\n' order by m.created_at,m.id)
      from (select sender_id,created_at,id,body from messages
        where conversation_id=c.id order by created_at desc,id desc limit 20) m
    ),'No messages yet') into subject,summary
  from conversations c where c.id=p_target and auth.uid() in(c.user_a,c.user_b);
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
  if r.target_kind in ('user','conversation') then raise exception 'Use suspend for an account, or report a specific message for removal';end if;
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
commit;
