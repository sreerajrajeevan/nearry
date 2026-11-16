-- Nearry usage report. Read-only: run any block in the Supabase SQL editor.
-- Uses data the app already stores (no extra tracking). Counts are
-- aggregates only; nothing here lists people.
-- Tip: during testing, sample/reviewer accounts are included in the numbers.

-- 1. Sign-up funnel by week: of people who joined that week, how many got
--    through each step (personal accounts).
with people as (
  select id, created_at, onboarding_completed
  from profiles
  where account_type = 'personal'
)
select
  date_trunc('week', p.created_at)::date as signup_week,
  count(*) as signed_up,
  count(*) filter (where p.onboarding_completed) as finished_onboarding,
  count(*) filter (where exists (
    select 1 from posts x where x.author_id = p.id)) as posted_a_plan,
  count(*) filter (where exists (
    select 1 from join_requests r where r.requester_id = p.id)) as asked_to_join,
  count(*) filter (where exists (
    select 1 from join_requests r
    where r.requester_id = p.id and r.status = 'approved')) as joined_a_plan,
  count(*) filter (where exists (
    select 1 from plan_group_messages m where m.sender_id = p.id)) as chatted_in_a_group
from people p
group by 1
order by 1 desc
limit 12;

-- 2. Weekly activity: what happened each week, and how many different
--    people did something (a stand-in for weekly active users).
with acts as (
  select author_id as who, created_at as at, 'plan' as kind from posts
  union all select requester_id, created_at, 'request' from join_requests
  union all select customer_id, created_at, 'booking' from bookings
  union all select sender_id, created_at, 'group_message' from plan_group_messages
)
select
  date_trunc('week', at)::date as week,
  count(*) filter (where kind = 'plan') as plans_posted,
  count(*) filter (where kind = 'request') as join_requests,
  count(*) filter (where kind = 'booking') as offer_bookings,
  count(*) filter (where kind = 'group_message') as group_messages,
  count(distinct who) as active_people
from acts
group by 1
order by 1 desc
limit 12;

-- 3. Are plans getting interest? Share of plans with at least one request,
--    and with at least one approved member, by the week they were posted.
select
  date_trunc('week', p.created_at)::date as week,
  count(*) as plans,
  round(100.0 * count(*) filter (where exists (
    select 1 from join_requests r where r.post_id = p.id)) / nullif(count(*), 0))
    as pct_with_a_request,
  round(100.0 * count(*) filter (where exists (
    select 1 from join_requests r where r.post_id = p.id and r.status = 'approved'))
    / nullif(count(*), 0)) as pct_with_a_member
from posts p
group by 1
order by 1 desc
limit 12;

-- 4. Coming back: of people active in a week, how many were active again
--    the following week.
with acts as (
  select author_id as who, created_at as at from posts
  union all select requester_id, created_at from join_requests
  union all select customer_id, created_at from bookings
  union all select sender_id, created_at from plan_group_messages
), weeks as (
  select distinct who, date_trunc('week', at)::date as week from acts
)
select
  w.week,
  count(*) as active,
  count(*) filter (where exists (
    select 1 from weeks n where n.who = w.who and n.week = w.week + 7)) as active_next_week
from weeks w
group by 1
order by 1 desc
limit 12;

-- 5. Businesses: offers and bookings by week.
with o as (
  select date_trunc('week', created_at)::date as week,
         count(*) as offers_created,
         count(distinct business_id) as businesses_posting
  from offers group by 1
), b as (
  select date_trunc('week', created_at)::date as week, count(*) as bookings
  from bookings group by 1
)
select coalesce(o.week, b.week) as week,
       coalesce(o.offers_created, 0) as offers_created,
       coalesce(o.businesses_posting, 0) as businesses_posting,
       coalesce(b.bookings, 0) as bookings
from o full join b on b.week = o.week
order by 1 desc
limit 12;
