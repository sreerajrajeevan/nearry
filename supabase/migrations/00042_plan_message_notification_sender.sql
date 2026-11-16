-- Add the sender to group-message previews without changing chat membership,
-- read state, timestamps, or the deliberately generic device push payload.
begin;

create or replace function notify_plan_group_message() returns trigger as $$
declare sender_name text;
begin
 select left(coalesce(nullif(btrim(regexp_replace(display_name,'[[:space:]]+',' ','g')),''),'Someone'),80)
 into sender_name from profiles where id=new.sender_id;
 insert into notifications(user_id,kind,title,body,ref_id,created_at)
 select m.id,'plan_group_message',g.name,coalesce(sender_name,'Someone')||': '||left(new.body,140),new.id,new.created_at
 from plan_groups g join posts p on p.id=g.post_id join profiles m on (m.id=p.author_id or exists(select 1 from join_requests r where r.post_id=p.id and r.requester_id=m.id and r.status='approved'))
 where g.id=new.group_id and m.id<>new.sender_id and plan_group_member(g.id,m.id) and not users_blocked(m.id,new.sender_id);
 return new;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function notify_plan_group_message() from public,anon,authenticated;

-- Rebuild only existing group-message previews from their retained messages.
-- Updates do not enqueue another push or reset an already-read notification.
update notifications n
set body=left(coalesce(nullif(btrim(regexp_replace(s.display_name,'[[:space:]]+',' ','g')),''),'Someone'),80)||': '||left(m.body,140)
from plan_group_messages m join profiles s on s.id=m.sender_id
where n.kind='plan_group_message' and n.ref_id=m.id
 and n.body is distinct from left(coalesce(nullif(btrim(regexp_replace(s.display_name,'[[:space:]]+',' ','g')),''),'Someone'),80)||': '||left(m.body,140);

commit;
