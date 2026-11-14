-- Plan-based inbox: order the bounded result by the plan calendar, not message traffic.
-- Existing private 1:1 history is retained and never copied to a group.
begin;
create or replace function get_plan_group(p_group_id uuid default null,p_post_id uuid default null,p_message_id uuid default null) returns jsonb as $$
declare g plan_groups; p posts; result jsonb;
begin
 if num_nonnulls(p_group_id,p_post_id,p_message_id)<>1 then raise exception 'Choose one plan group';end if;
 select * into g from plan_groups where (id=p_group_id or post_id=p_post_id or id=(select group_id from plan_group_messages where id=p_message_id));
 if not found or not plan_group_member(g.id,auth.uid()) then raise exception 'This group is only for the host and approved plan members';end if;
 select * into p from posts where id=g.post_id;
 select jsonb_build_object('id',g.id,'postId',g.post_id,'name',g.name,'hostId',p.author_id,'planTitle',p.title,'startsAt',p.starts_at,'durationMinutes',p.plan_details->'durationMinutes','venueName',p.venue_name,'activity',p.plan_details->>'activity','cancelled',p.status='cancelled','memberCount',1+approved_join_count(p.id),'members',coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',m.display_name,'host',m.id=p.author_id) order by m.id=p.author_id desc,m.display_name),'[]')) into result
 from profiles m where (m.id=p.author_id or exists(select 1 from join_requests r where r.post_id=p.id and r.requester_id=m.id and r.status='approved')) and account_active(m.id) and not users_blocked(m.id,auth.uid());
 return result;
end;
$$ language plpgsql stable security definer set search_path=public,pg_temp;

-- Explicit timezone argument avoids using the database UTC date for a device's Today.
create function list_my_plan_groups(p_timezone text) returns jsonb as $$
 with zone as (
   select coalesce((select name from pg_timezone_names where name=p_timezone limit 1),'Asia/Kolkata') name
 ), eligible as materialized (
   select g.id,g.post_id,g.name,g.created_at,p.author_id,p.title,p.starts_at,p.status,p.venue_name,p.plan_details,
     case when p.status='cancelled' then 3
       when timezone(z.name,p.starts_at)::date=timezone(z.name,now())::date
         or (p.starts_at<=now() and p.starts_at+coalesce((p.plan_details->>'durationMinutes')::int,0)*interval '1 minute'>now()) then 0
       when p.starts_at>now() then 1 else 2 end priority,
     case when p.starts_at+coalesce((p.plan_details->>'durationMinutes')::int,0)*interval '1 minute'<=now() then 1 else 0 end finished
   from plan_groups g join posts p on p.id=g.post_id cross join zone z
   where g.post_id in(select id from posts where author_id=auth.uid() union select post_id from join_requests where requester_id=auth.uid() and status='approved')
     and plan_group_member(g.id,auth.uid())
 ), ranked as materialized (
   select * from eligible
   order by priority,case when priority=0 then finished else 0 end,
     case when priority in(0,1) then starts_at end,
     case when priority in(2,3) then starts_at end desc,id
   limit 200
 ), cards as (
   select jsonb_build_object('id',g.id,'postId',g.post_id,'name',g.name,'hostId',g.author_id,'planTitle',g.title,
     'startsAt',g.starts_at,'durationMinutes',g.plan_details->'durationMinutes','venueName',g.venue_name,'activity',g.plan_details->>'activity',
     'cancelled',g.status='cancelled','memberCount',1+approved_join_count(g.post_id),
     'lastBody',last_msg.body,'lastAt',last_msg.created_at,'lastSenderName',last_msg.sender_name,
     'unreadCount',(select count(*) from plan_group_messages m where m.group_id=g.id and m.sender_id<>auth.uid() and m.seq>coalesce(rd.last_seq,0) and visible_author(m.sender_id) and content_visible('plan_message',m.id))) item,
     g.id,g.priority,g.finished,g.starts_at
   from ranked g left join plan_group_reads rd on rd.group_id=g.id and rd.user_id=auth.uid()
   left join lateral(
     select m.body,m.created_at,s.display_name sender_name
     from plan_group_messages m join profiles s on s.id=m.sender_id
     where m.group_id=g.id and visible_author(m.sender_id) and content_visible('plan_message',m.id)
     order by m.seq desc limit 1
   ) last_msg on true
 )
 select coalesce(jsonb_agg(item order by priority,case when priority=0 then finished else 0 end,
   case when priority in(0,1) then starts_at end,
   case when priority in(2,3) then starts_at end desc,id),'[]'::jsonb) from cards;
$$ language sql stable security definer set search_path=public,pg_temp;

-- Keep older installed app versions working; the new client sends its IANA timezone.
create or replace function list_my_plan_groups() returns jsonb as $$
 select list_my_plan_groups('Asia/Kolkata');
$$ language sql stable security definer set search_path=public,pg_temp;
revoke all on function list_my_plan_groups(text) from public,anon;
grant execute on function list_my_plan_groups(text) to authenticated;
commit;
