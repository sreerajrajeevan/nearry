-- Open a plan chat only once a real participant has been approved.
-- Retain old group records/history; host-only groups become invisible, never erased.
begin;
drop trigger sync_plan_group on posts;
create or replace function sync_plan_group() returns trigger as $$
begin
 if new.title is distinct from old.title then
   update plan_groups set name=new.title where post_id=new.id and not custom_name;
 end if;
 return new;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
create trigger sync_plan_group after update of title on posts for each row execute function sync_plan_group();

create function activate_plan_group_on_approval() returns trigger as $$
declare plan posts;
begin
 if new.status='approved' then
   select * into plan from posts where id=new.post_id for update;
   if found and new.requester_id<>plan.author_id then
     insert into plan_groups(post_id,name) values(plan.id,plan.title) on conflict(post_id) do nothing;
   end if;
 end if;
 return new;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
create trigger activate_plan_group_on_approval after insert or update of status on join_requests
 for each row execute function activate_plan_group_on_approval();
revoke all on function activate_plan_group_on_approval() from public,anon,authenticated;

insert into plan_groups(post_id,name)
 select p.id,p.title from posts p where exists(select 1 from join_requests r where r.post_id=p.id and r.status='approved' and r.requester_id<>p.author_id)
 on conflict(post_id) do nothing;
create or replace function plan_group_member(p_group uuid,p_user uuid) returns boolean as $$
 select coalesce(account_active(p_user) and exists(select 1 from plan_groups g join posts p on p.id=g.post_id where g.id=p_group and account_active(p.author_id) and not users_blocked(p.author_id,p_user) and content_visible('post',p.id) and exists(select 1 from join_requests participant where participant.post_id=p.id and participant.status='approved' and participant.requester_id<>p.author_id and account_active(participant.requester_id) and not users_blocked(p.author_id,participant.requester_id)) and (p.author_id=p_user or exists(select 1 from join_requests r where r.post_id=p.id and r.requester_id=p_user and r.status='approved'))),false);
$$ language sql stable security definer set search_path=public,pg_temp;

-- All current/older inbox RPCs, reads, sends and unread counts use this membership
-- guard, so no host-only room can leak through a different screen or an older build.
commit;
