begin;
-- Plan chats show WhatsApp-style lines such as "Anu joined" and "Rahul left".
-- join_requests only keeps the current status, so this log records the moment
-- someone becomes an approved member or stops being one. Only the database
-- writes it; members of the plan's group read it.
create table public.plan_group_events(
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('joined','left','removed')),
  created_at timestamptz not null default clock_timestamp()
);
create index plan_group_events_post on public.plan_group_events(post_id,created_at);
create index plan_group_events_user on public.plan_group_events(user_id);
alter table public.plan_group_events enable row level security;
revoke all on public.plan_group_events from public,anon,authenticated;
grant select on public.plan_group_events to authenticated;
grant all on public.plan_group_events to service_role;
create policy "plan members see join and leave lines" on public.plan_group_events for select to authenticated
 using (
  exists(select 1 from public.plan_groups g where g.post_id=plan_group_events.post_id and public.my_plan_group_member(g.id))
  and public.visible_author(user_id)
 );

create function public.log_plan_membership() returns trigger as $$
begin
 if new.status='approved' and (tg_op='INSERT' or old.status is distinct from 'approved') then
  insert into public.plan_group_events(post_id,user_id,kind) values(new.post_id,new.requester_id,'joined');
 elsif tg_op='UPDATE' and old.status='approved' and new.status<>'approved' then
  insert into public.plan_group_events(post_id,user_id,kind)
  values(new.post_id,new.requester_id,case when new.status='withdrawn' then 'left' else 'removed' end);
 end if;
 return null;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.log_plan_membership() from public,anon,authenticated;
create trigger log_plan_membership after insert or update of status on public.join_requests
 for each row execute function public.log_plan_membership();

do $$begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.plan_group_events;
 end if;
end$$;
commit;
