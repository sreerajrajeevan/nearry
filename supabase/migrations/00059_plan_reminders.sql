begin;
-- Plan reminders: a same-day push to the host and members, "Going / Not
-- going" answers, and a count of confirmations for the host.
-- Design: docs/superpowers/specs/2026-11-24-plan-reminders-design.md

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
 'join_request','request_approved','request_declined','request_full','post_cancelled',
 'booking','booking_confirmed','booking_cancelled','message','verification_approved',
 'verification_rejected','selfie_review','plan_group_message','plan_reminder'));

create table public.plan_attendance(
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('going','not_going')),
  updated_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index plan_attendance_user on public.plan_attendance(user_id);
alter table public.plan_attendance enable row level security;
revoke all on public.plan_attendance from public,anon,authenticated;
grant select on public.plan_attendance to authenticated;
grant all on public.plan_attendance to service_role;
create policy "own answer or host of the plan" on public.plan_attendance for select to authenticated
 using (user_id = (select auth.uid())
   or exists(select 1 from public.posts p where p.id = plan_attendance.post_id and p.author_id = (select auth.uid())));

create function public.plan_is_member(p_post uuid, p_user uuid) returns boolean as $$
 select exists(select 1 from join_requests where post_id = p_post and requester_id = p_user and status = 'approved');
$$ language sql stable security definer set search_path=public,pg_temp;
revoke all on function public.plan_is_member(uuid,uuid) from public,anon,authenticated;

create function public.set_plan_attendance(p_post uuid, p_going boolean) returns void as $$
begin
 if auth.uid() is null or not account_active(auth.uid()) or not plan_is_member(p_post, auth.uid()) then
  raise exception 'Only people in this plan can answer';
 end if;
 insert into plan_attendance(post_id, user_id, status, updated_at)
 values (p_post, auth.uid(), case when p_going then 'going' else 'not_going' end, now())
 on conflict (post_id, user_id) do update set status = excluded.status, updated_at = now();
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.set_plan_attendance(uuid,boolean) from public,anon;
grant execute on function public.set_plan_attendance(uuid,boolean) to authenticated;

-- Going / not going counts among current members.
create function public.plan_attendance_counts(p_post uuid) returns jsonb as $$
 select jsonb_build_object(
  'going', count(*) filter (where a.status = 'going'),
  'notGoing', count(*) filter (where a.status = 'not_going'),
  'members', count(*))
 from join_requests j
 left join plan_attendance a on a.post_id = j.post_id and a.user_id = j.requester_id
 where j.post_id = p_post and j.status = 'approved';
$$ language sql stable security definer set search_path=public,pg_temp;
revoke all on function public.plan_attendance_counts(uuid) from public,anon,authenticated;

create function public.plan_attendance_summary(p_post uuid) returns jsonb as $$
begin
 if not exists(select 1 from posts where id = p_post and author_id = auth.uid()) then
  raise exception 'Only the host can see who confirmed';
 end if;
 return plan_attendance_counts(p_post);
end;
$$ language plpgsql stable security definer set search_path=public,pg_temp;
revoke all on function public.plan_attendance_summary(uuid) from public,anon;
grant execute on function public.plan_attendance_summary(uuid) to authenticated;

-- The signed-in person's plans on the India-time day of p_at that haven't
-- started yet: hosting or approved member, not cancelled. Earliest first.
create function public.plans_for_day(p_at timestamptz default now()) returns jsonb as $$
 with day as (select timezone('Asia/Kolkata', p_at)::date d),
 mine as (
  select p.*, (p.author_id = auth.uid()) is_host
  from posts p, day
  where p.status <> 'cancelled' and p.starts_at > p_at
   and timezone('Asia/Kolkata', p.starts_at)::date = day.d
   and (p.author_id = auth.uid() or plan_is_member(p.id, auth.uid()))
 )
 select coalesce(jsonb_agg(jsonb_build_object(
   'postId', m.id, 'title', m.title, 'startsAt', m.starts_at,
   'place', coalesce(v.name, nullif(m.venue_name, '')),
   'host', m.is_host,
   'myStatus', (select a.status from plan_attendance a where a.post_id = m.id and a.user_id = auth.uid()),
   'going', (plan_attendance_counts(m.id)->>'going')::int,
   'members', (plan_attendance_counts(m.id)->>'members')::int
  ) order by m.starts_at, m.id), '[]'::jsonb)
 from mine m left join venues v on v.id = m.venue_id;
$$ language sql stable security definer set search_path=public,pg_temp;
revoke all on function public.plans_for_day(timestamptz) from public,anon;
grant execute on function public.plans_for_day(timestamptz) to authenticated;

-- Sends due reminders and returns how many. Due at 8:00 am India time on the
-- plan's day, or 2 hours before the start if that is earlier; once per person
-- per plan. Run every 10 minutes by supabase/ops/setup-maintenance.sql.
create function public.send_plan_reminders(p_now timestamptz default now()) returns int as $$
declare sent int;
begin
 with due as (
  select p.id, p.author_id, p.title, p.starts_at,
   coalesce(v.name, nullif(p.venue_name, ''), 'the meeting place') place,
   lower(to_char(timezone('Asia/Kolkata', p.starts_at), 'FMHH12:MI am')) at_time
  from posts p left join venues v on v.id = p.venue_id
  where p.status <> 'cancelled'
   and p.starts_at > p_now
   and p.starts_at <= p_now + interval '24 hours'
   and timezone('Asia/Kolkata', p.starts_at)::date = timezone('Asia/Kolkata', p_now)::date
   and p_now >= least(
     (timezone('Asia/Kolkata', p.starts_at)::date + time '08:00') at time zone 'Asia/Kolkata',
     p.starts_at - interval '2 hours')
 ),
 people as (
  select d.*, d.author_id person, true is_host from due d
  union all
  select d.*, j.requester_id, false from due d
  join join_requests j on j.post_id = d.id and j.status = 'approved'
 ),
 inserted as (
  insert into notifications(user_id, kind, ref_id, title, body)
  select x.person, 'plan_reminder', x.id,
   case when x.is_host then 'You''re hosting today: ' else 'Today: ' end || x.title,
   case when x.is_host then
     x.at_time || ' at ' || x.place || '. '
     || (plan_attendance_counts(x.id)->>'going') || ' of '
     || (plan_attendance_counts(x.id)->>'members') || ' confirmed so far.'
   else x.at_time || ' at ' || x.place || '. Still going?' end
  from people x
  where account_active(x.person)
   and not exists(select 1 from notifications n
     where n.user_id = x.person and n.kind = 'plan_reminder' and n.ref_id = x.id)
  returning 1
 )
 select count(*) into sent from inserted;
 return sent;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.send_plan_reminders(timestamptz) from public,anon,authenticated;
grant execute on function public.send_plan_reminders(timestamptz) to service_role;
commit;
