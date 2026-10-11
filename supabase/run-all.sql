-- NEARRY database setup — ONE-SHOT file for the Supabase dashboard SQL editor.
-- Paste this entire file into SQL Editor > New query and run it once.
-- It runs migrations 00001–00010 in order. Safe to re-run (uses if-not-exists / drops).

-- ═══════════════════════════════════════════════════════════
-- supabase/migrations/00001_baseline.sql
-- ═══════════════════════════════════════════════════════════
-- Nearry MVP — Supabase schema (milestone 2 wiring)
-- Run in the Supabase SQL editor. Enables PostGIS for venue proximity.

create extension if not exists "postgis";

-- Profiles: one row per auth user, stamped with account type at signup.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  account_type text not null check (account_type in ('personal', 'business')),
  display_name text not null,
  avatar_url text,
  bio text,
  created_at timestamptz default now()
);

-- Venues (businesses + public spots). Businesses claim a venue via business_id.
create table venues (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references profiles(id),
  name text not null,
  category text not null,
  area text not null,
  location geography(point, 4326),
  rating numeric(2,1) default 0,
  open_now boolean default true,
  created_at timestamptz default now()
);
create index venues_location_idx on venues using gist (location);

-- Need-People posts. vacancies auto-close enforced by trigger below.
create table posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text not null,
  venue_id uuid references venues(id),
  venue_name text,
  starts_at timestamptz not null,
  vacancies int not null check (vacancies > 0),
  tags text[] default '{}',
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz default now()
);

-- Join requests: one pending request per user per post.
create table join_requests (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  requester_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  created_at timestamptz default now(),
  unique (post_id, requester_id)
);

-- Auto-close a post when approved joins fill every vacancy.
create or replace function close_post_when_full() returns trigger as $$
declare
  approved_count int;
  vacancy_count int;
begin
  if new.status = 'approved' then
    select count(*) into approved_count from join_requests
      where post_id = new.post_id and status = 'approved';
    select vacancies into vacancy_count from posts where id = new.post_id;
    if approved_count >= vacancy_count then
      update posts set status = 'closed' where id = new.post_id;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_close_post_when_full
  after insert or update of status on join_requests
  for each row execute function close_post_when_full();

-- Business offers (incl. last-minute). Redemptions counted in app for MVP.
create table offers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text not null,
  discount_pct int check (discount_pct between 0 and 90),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  max_redemptions int,
  redemptions int not null default 0,
  status text not null default 'live' check (status in ('live','ended')),
  created_at timestamptz default now()
);

-- Bookings of an offer by a personal user.
create table bookings (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  customer_id uuid not null references profiles(id) on delete cascade,
  slot timestamptz not null,
  party_size int not null default 1,
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled')),
  created_at timestamptz default now()
);

-- Chat threads (milestone 3) + messages.
create table threads (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  created_at timestamptz default now()
);
create table messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references threads(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

-- Notifications (milestone 3; push fan-out via edge function).
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz default now()
);

-- Proximity RPC used by the location service in milestone 2.
create or replace function nearby_venues(lat double precision, lng double precision, radius_m int)
returns setof venues as $$
  select * from venues
  where location is not null
    and st_dwithin(location, st_setsrid(st_makepoint(lng, lat), 4326)::geography, radius_m)
  order by location <-> st_setsrid(st_makepoint(lng, lat), 4326)::geography;
$$ language sql stable;

-- ── Auto-create a profiles row at signup ──
-- Stashes display_name + account_type from signup metadata; security definer
-- so it runs regardless of RLS.
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, account_type, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'account_type', 'personal'),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), 'user')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Row Level Security ──
-- Without this the tables are wide open to the anon key on a fresh project.
alter table profiles enable row level security;
alter table venues enable row level security;
alter table posts enable row level security;
alter table join_requests enable row level security;
alter table offers enable row level security;
alter table bookings enable row level security;
alter table threads enable row level security;
alter table messages enable row level security;
alter table notifications enable row level security;

-- Profiles: anyone can read; users manage their own row.
create policy "profiles read" on profiles for select using (true);
create policy "profiles self-insert" on profiles for insert with check (auth.uid() = id);
create policy "profiles self-update" on profiles for update using (auth.uid() = id);

-- Venues: public directory; authenticated users add claimed venues, owners edit.
create policy "venues read" on venues for select using (true);
create policy "venues insert" on venues for insert with check (auth.uid() = business_id);
create policy "venues owner update" on venues for update using (auth.uid() = business_id);

-- Posts: public read; authors write their own.
create policy "posts read" on posts for select using (true);
create policy "posts author insert" on posts for insert with check (auth.uid() = author_id);
create policy "posts author update" on posts for update using (auth.uid() = author_id);
create policy "posts author delete" on posts for delete using (auth.uid() = author_id);

-- Join requests: requesters insert their own; the post author sees and manages them.
create policy "jr insert" on join_requests for insert with check (auth.uid() = requester_id);
create policy "jr read involved" on join_requests for select using (
  auth.uid() = requester_id
  or exists (select 1 from posts p where p.id = join_requests.post_id and p.author_id = auth.uid())
);
create policy "jr author update" on join_requests for update using (
  exists (select 1 from posts p where p.id = join_requests.post_id and p.author_id = auth.uid())
);
create policy "jr requester delete" on join_requests for delete using (auth.uid() = requester_id);

-- Offers: everyone reads live ones; the business owner manages its own.
create policy "offers read live" on offers for select using (status = 'live');
create policy "offers owner all" on offers for all
  using (auth.uid() = business_id) with check (auth.uid() = business_id);

-- Bookings: customer and the offer's business read; customer books; both manage.
create policy "bookings read" on bookings for select using (
  auth.uid() = customer_id
  or exists (select 1 from offers o where o.id = bookings.offer_id and o.business_id = auth.uid())
);
create policy "bookings customer insert" on bookings for insert with check (auth.uid() = customer_id);
create policy "bookings involved update" on bookings for update using (
  auth.uid() = customer_id
  or exists (select 1 from offers o where o.id = bookings.offer_id and o.business_id = auth.uid())
);

-- Threads: the booking's customer and business can see and start them.
create policy "threads involved read" on threads for select using (
  exists (
    select 1 from bookings b join offers o on o.id = b.offer_id
    where b.id = threads.booking_id and (b.customer_id = auth.uid() or o.business_id = auth.uid())
  )
);
create policy "threads involved insert" on threads for insert with check (
  exists (
    select 1 from bookings b join offers o on o.id = b.offer_id
    where b.id = threads.booking_id and (b.customer_id = auth.uid() or o.business_id = auth.uid())
  )
);

-- Messages: thread participants read; anyone sends as themselves.
create policy "messages involved read" on messages for select using (
  exists (
    select 1 from threads t join bookings b on b.id = t.booking_id join offers o on o.id = b.offer_id
    where t.id = messages.thread_id and (b.customer_id = auth.uid() or o.business_id = auth.uid())
  )
);
create policy "messages sender insert" on messages for insert with check (
  auth.uid() = sender_id and exists (
    select 1 from threads t join bookings b on b.id = t.booking_id join offers o on o.id = b.offer_id
    where t.id = messages.thread_id and (b.customer_id = auth.uid() or o.business_id = auth.uid())
  )
);

-- Notifications (milestone 3): strictly per-user.
create policy "notifications self" on notifications for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
-- supabase/migrations/00002_profile_fields.sql
-- ═══════════════════════════════════════════════════════════
-- Migration 00002 — profile fields for onboarding + business verification.
-- Adds: interests, business_name, business_details, verification_status,
-- onboarding_completed. Verification status is admin-managed: clients
-- cannot change it (trigger below); service_role bypasses via null auth.uid().

alter table profiles
  add column if not exists interests text[] not null default '{}',
  add column if not exists business_name text,
  add column if not exists business_details jsonb not null default '{}',
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  add column if not exists onboarding_completed boolean not null default false;

-- Business name is required for business accounts (checked on write path too).
-- Admin-managed verification_status: reject client attempts to change it.
create or replace function protect_profile_fields() returns trigger as $$
begin
  if new.verification_status is distinct from old.verification_status
     and auth.uid() is not null then
    raise exception 'verification_status is managed by admins';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_protect_profile_fields on profiles;
create trigger trg_protect_profile_fields
  before update on profiles
  for each row execute function protect_profile_fields();

-- Keep the auto-create trigger in sync with the new columns.
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, account_type, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'account_type', 'personal'),
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'business_name',
      split_part(new.email, '@', 1),
      'user'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- ═══════════════════════════════════════════════════════════
-- supabase/migrations/00003_post_fields.sql
-- ═══════════════════════════════════════════════════════════
-- Migration 00003 — post lifecycle fields.
-- Adds: expires_at (auto-close), cost_cents (optional cost), 'cancelled'
-- post status, 'withdrawn' join-request status. Server-side CHECKs mirror
-- src/utils/validation.ts.

alter table posts
  add column if not exists expires_at timestamptz,
  add column if not exists cost_cents int check (cost_cents is null or cost_cents >= 0);

-- Widen status enums (no data loss: existing values remain valid).
alter table posts drop constraint if exists posts_status_check;
alter table posts add constraint posts_status_check
  check (status in ('open', 'closed', 'cancelled'));

alter table join_requests drop constraint if exists join_requests_status_check;
alter table join_requests add constraint join_requests_status_check
  check (status in ('pending', 'approved', 'declined', 'withdrawn'));

-- Expiry must precede the start time; start must be in the future at write.
alter table posts add constraint posts_expiry_before_start
  check (expires_at is null or expires_at < starts_at);

-- Close expired posts server-side. Call on a schedule (Supabase dashboard
-- cron / pg_cron where available); also enforced in approve_join_request()
-- and filtered in list queries so expiry never depends on the cron alone.
create or replace function close_expired_posts() returns int as $$
declare
  closed_count int;
begin
  update posts set status = 'closed'
  where status = 'open' and expires_at is not null and expires_at <= now();
  get diagnostics closed_count = row_count;
  return closed_count;
end;
$$ language plpgsql security definer set search_path = public;

-- ═══════════════════════════════════════════════════════════
-- supabase/migrations/00004_approve_rpc.sql
-- ═══════════════════════════════════════════════════════════
-- Migration 00004 — atomic join-request approval + withdrawal.
--
-- approve_join_request() locks the post row (FOR UPDATE) so concurrent
-- approvals serialize: capacity can never be overfilled. It enforces, in
-- order: request exists & pending, post open & unexpired, no self-join,
-- caller is the post author, capacity remains. On fill, the post closes.
--
-- Withdrawals (delete, or status -> withdrawn/declined) reopen a post that
-- was closed only because it filled up — never an expired one.

create or replace function approve_join_request(p_request_id uuid)
returns json as $$
declare
  v_post_id uuid;
  v_author uuid;
  v_requester uuid;
  v_req_status text;
  v_vacancies int;
  v_approved int;
  v_post_status text;
  v_expires timestamptz;
begin
  select post_id, requester_id, status
    into v_post_id, v_requester, v_req_status
  from join_requests where id = p_request_id for update;
  if not found then
    raise exception 'join request not found';
  end if;
  if v_req_status != 'pending' then
    raise exception 'join request is not pending';
  end if;

  -- Serialize concurrent approvals on the post row.
  select author_id, vacancies, status, expires_at
    into v_author, v_vacancies, v_post_status, v_expires
  from posts where id = v_post_id for update;
  if not found then
    raise exception 'post not found';
  end if;
  if v_author != auth.uid() then
    raise exception 'only the host can approve join requests';
  end if;
  if v_requester = v_author then
    raise exception 'cannot join your own post';
  end if;
  if v_post_status != 'open' then
    raise exception 'post is not open';
  end if;
  if v_expires is not null and v_expires <= now() then
    update posts set status = 'closed' where id = v_post_id;
    raise exception 'post has expired';
  end if;

  select count(*) into v_approved from join_requests
  where post_id = v_post_id and status = 'approved';
  if v_approved >= v_vacancies then
    raise exception 'post is already full';
  end if;

  update join_requests set status = 'approved' where id = p_request_id;

  if v_approved + 1 >= v_vacancies then
    update posts set status = 'closed' where id = v_post_id;
  end if;

  return json_build_object(
    'approved', true,
    'spots_left', greatest(v_vacancies - v_approved - 1, 0),
    'post_closed', (v_approved + 1) >= v_vacancies
  );
end;
$$ language plpgsql security definer set search_path = public;

-- Reopen a post closed by filling up when an approved join is withdrawn
-- or declined afterwards. Expired posts stay closed.
create or replace function reopen_post_if_space() returns trigger as $$
declare
  v_post_id uuid;
  v_vacancies int;
  v_post_status text;
  v_expires timestamptz;
  v_approved int;
begin
  v_post_id := old.post_id;
  if tg_op = 'UPDATE' and new.status = 'approved' then
    return new; -- still approved: nothing to release
  end if;

  select vacancies, status, expires_at
    into v_vacancies, v_post_status, v_expires
  from posts where id = v_post_id;
  if not found then
    return coalesce(new, old);
  end if;

  select count(*) into v_approved from join_requests
  where post_id = v_post_id and status = 'approved';

  if v_post_status = 'closed'
     and v_approved < v_vacancies
     and (v_expires is null or v_expires > now()) then
    update posts set status = 'open' where id = v_post_id;
  end if;

  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_reopen_post_on_withdraw on join_requests;
create trigger trg_reopen_post_on_withdraw
  after update of status or delete on join_requests
  for each row execute function reopen_post_if_space();

-- The baseline close-when-full trigger stays as a backstop for any
-- approval path that doesn't go through the RPC.

-- ═══════════════════════════════════════════════════════════
-- supabase/migrations/00005_seed_venues.sql
-- ═══════════════════════════════════════════════════════════
-- Migration 00005 — seed a small starter venue list.
-- Keeps the app useful before any location-provider integration;
-- venues stay editable/claimable by businesses afterwards.

insert into venues (name, category, area, rating, open_now) values
  ('Unity Turf', 'Sports', 'Kakkanad', 4.6, true),
  ('Rajiv Gandhi Indoor Stadium', 'Sports', 'Kadavanthra', 4.4, true),
  ('Backwater Kayak Co.', 'Outdoors', 'Marine Drive', 4.8, true),
  ('Kochi Marine Brews', 'Café', 'Marine Drive', 4.3, true),
  ('Cochin Board Game House', 'Games', 'Fort Kochi', 4.7, false),
  ('Subhash Park Courts', 'Sports', 'Ernakulam South', 4.1, true)
on conflict do nothing;

-- ═══════════════════════════════════════════════════════════
-- supabase/migrations/00006_rls_hardening.sql
-- ═══════════════════════════════════════════════════════════
-- Migration 00006 — RLS hardening for the join-request lifecycle.
--
-- 1. Approvals MUST go through approve_join_request() (row-locked, atomic).
--    Direct updates can only decline/withdraw; setting 'approved' directly
--    is rejected so capacity can never be bypassed.
-- 2. Insert guard: no self-join, and only into open, unexpired posts.
--    (The RPC re-checks all of this; RLS is defense in depth.)

drop policy if exists "jr author update" on join_requests;
create policy "jr author update" on join_requests for update
  using (
    exists (select 1 from posts p
            where p.id = join_requests.post_id and p.author_id = auth.uid())
  )
  with check (
    status <> 'approved'
    and exists (select 1 from posts p
                where p.id = join_requests.post_id and p.author_id = auth.uid())
  );

drop policy if exists "jr insert" on join_requests;
create policy "jr insert" on join_requests for insert with check (
  auth.uid() = requester_id
  and not exists (
    select 1 from posts p where p.id = post_id and p.author_id = auth.uid()
  )
  and exists (
    select 1 from posts p
    where p.id = post_id
      and p.status = 'open'
      and (p.expires_at is null or p.expires_at > now())
  )
);

-- ═══════════════════════════════════════════════════════════
-- supabase/migrations/00007_post_readmodel.sql
-- ═══════════════════════════════════════════════════════════
-- Migration 00007 — post read model + host edit guard.
--
-- post_cards: posts with author name + approved count in one round trip.
-- security_invoker so the caller's RLS applies (Postgres 15+).
create or replace view post_cards as
select
  p.*,
  pr.display_name as author_name,
  (select count(*) from join_requests jr
    where jr.post_id = p.id and jr.status = 'approved')::int as approved_count
from posts p
join profiles pr on pr.id = p.author_id;

alter view post_cards set (security_invoker = true);
grant select on post_cards to anon, authenticated;

-- Host edit rules, enforced server-side:
-- - only the author can edit (RLS already covers this; belt and braces)
-- - vacancies can never drop below the approved count
-- - starts_at must stay in the future
-- - a closed/cancelled post cannot be edited (cancel is terminal)
create or replace function guard_post_edit() returns trigger as $$
declare
  v_approved int;
begin
  if old.author_id != auth.uid() then
    raise exception 'only the host can edit this post';
  end if;
  if old.status != 'open' then
    raise exception 'only open posts can be edited';
  end if;
  select count(*) into v_approved from join_requests
  where post_id = old.id and status = 'approved';
  if new.vacancies < v_approved then
    raise exception 'vacancies cannot be below the % approved join(s)', v_approved;
  end if;
  if new.starts_at <= now() then
    raise exception 'start time must be in the future';
  end if;
  if new.author_id is distinct from old.author_id then
    raise exception 'post ownership cannot change';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_guard_post_edit on posts;
create trigger trg_guard_post_edit
  before update of title, description, venue_id, venue_name, starts_at,
    expires_at, vacancies, cost_cents, tags on posts
  for each row execute function guard_post_edit();

-- Cancellation is a separate, always-allowed host action.
create or replace function cancel_post(p_post_id uuid) returns void as $$
begin
  update posts set status = 'cancelled'
  where id = p_post_id and author_id = auth.uid() and status = 'open';
  if not found then
    raise exception 'post not found, not open, or not yours';
  end if;
end;
$$ language plpgsql security definer set search_path = public;

-- ═══════════════════════════════════════════════════════════
-- supabase/migrations/00008_verification.sql
-- ═══════════════════════════════════════════════════════════
-- Migration 00008 — business verification: proof docs + status flow.
--
-- verification_doc_path: storage path of the submitted proof document.
-- Status flow:
--   owner may submit: unverified/rejected -> pending
--   admin (service_role, auth.uid() null) may set anything (review)
--   owner may NOT set verified/rejected, or change while pending.

alter table profiles
  add column if not exists verification_doc_path text;

create or replace function protect_profile_fields() returns trigger as $$
begin
  if new.verification_status is distinct from old.verification_status then
    if auth.uid() is null then
      return new; -- service_role: admin review path
    end if;
    if new.verification_status = 'pending'
       and old.verification_status in ('unverified', 'rejected') then
      return new; -- owner submitting for review
    end if;
    raise exception 'verification_status is managed by admins';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_protect_profile_fields on profiles;
create trigger trg_protect_profile_fields
  before update on profiles
  for each row execute function protect_profile_fields();

-- Private bucket for verification documents. Path convention: <user_id>/<file>.
insert into storage.buckets (id, name, public)
values ('verification_docs', 'verification_docs', false)
on conflict (id) do nothing;

drop policy if exists "owners upload own docs" on storage.objects;
create policy "owners upload own docs" on storage.objects for insert
  with check (
    bucket_id = 'verification_docs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "owners read own docs" on storage.objects;
create policy "owners read own docs" on storage.objects for select
  using (
    bucket_id = 'verification_docs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "owners delete own docs" on storage.objects;
create policy "owners delete own docs" on storage.objects for delete
  using (
    bucket_id = 'verification_docs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── Admin review ──
-- No app-side admin panel in this milestone. Reviewers use the service_role
-- key (never shipped in the app) via the Supabase dashboard SQL editor:
--
--   -- see the proof doc path, then:
--   update profiles set verification_status = 'verified' where id = '<uuid>';
--   -- or:
--   update profiles set verification_status = 'rejected' where id = '<uuid>';
--
-- The file itself: Storage -> verification_docs -> <user_id>/...

-- ═══════════════════════════════════════════════════════════
-- supabase/migrations/00009_offers_bookings.sql
-- ═══════════════════════════════════════════════════════════
-- Migration 00009 — offers lifecycle + atomic bookings + venue claims.
--
-- Offers: draft -> live -> ended/cancelled. Only VERIFIED businesses may
-- publish (guard_offer_publish); drafts are free to create.
-- Bookings: create_booking() locks the offer row so concurrent bookings for
-- the same slot serialize — capacity can never be overbooked. Capacity is
-- derived (sum of party_size over pending/confirmed), so cancellations free
-- seats automatically.

alter table offers
  add column if not exists venue_id uuid references venues(id),
  add column if not exists price_cents int check (price_cents is null or price_cents >= 0),
  add column if not exists slot_capacity int not null default 10
    check (slot_capacity > 0);

alter table offers drop constraint if exists offers_status_check;
alter table offers add constraint offers_status_check
  check (status in ('draft', 'live', 'ended', 'cancelled'));

-- Server-side publish gate: only verified businesses go live.
create or replace function guard_offer_publish() returns trigger as $$
declare
  v_verification text;
begin
  if new.status = 'live' and (tg_op = 'INSERT' or old.status is distinct from 'live') then
    select verification_status into v_verification from profiles where id = new.business_id;
    if v_verification is distinct from 'verified' then
      raise exception 'only verified businesses can publish offers';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_guard_offer_publish on offers;
create trigger trg_guard_offer_publish
  before insert or update of status on offers
  for each row execute function guard_offer_publish();

-- Atomic booking with per-slot capacity. Slots are exact timestamps sent by
-- the client (minute precision); the offer window bounds them.
create or replace function create_booking(
  p_offer_id uuid,
  p_slot timestamptz,
  p_party_size int
) returns json as $$
declare
  v_business uuid;
  v_status text;
  v_starts timestamptz;
  v_ends timestamptz;
  v_capacity int;
  v_taken int;
  v_customer uuid;
  v_booking_id uuid;
begin
  v_customer := auth.uid();
  if v_customer is null then
    raise exception 'not authenticated';
  end if;
  if p_party_size < 1 or p_party_size > 50 then
    raise exception 'party size must be between 1 and 50';
  end if;

  -- Serialize concurrent bookings for this offer.
  select business_id, status, starts_at, ends_at, slot_capacity
    into v_business, v_status, v_starts, v_ends, v_capacity
  from offers where id = p_offer_id for update;
  if not found then
    raise exception 'offer not found';
  end if;
  if v_status != 'live' then
    raise exception 'offer is not live';
  end if;
  if v_business = v_customer then
    raise exception 'cannot book your own offer';
  end if;
  if p_slot < v_starts or p_slot > v_ends then
    raise exception 'slot is outside the offer window';
  end if;
  if p_slot <= now() then
    raise exception 'slot must be in the future';
  end if;

  select coalesce(sum(party_size), 0) into v_taken from bookings
  where offer_id = p_offer_id and slot = p_slot and status in ('pending', 'confirmed');
  if v_taken + p_party_size > v_capacity then
    raise exception 'not enough seats left for this slot';
  end if;

  insert into bookings (offer_id, customer_id, slot, party_size, status)
  values (p_offer_id, v_customer, p_slot, p_party_size, 'pending')
  returning id into v_booking_id;

  return json_build_object(
    'booking_id', v_booking_id,
    'seats_left', v_capacity - v_taken - p_party_size
  );
end;
$$ language plpgsql security definer set search_path = public;

-- Business claims an unclaimed venue (sets business_id). Business accounts only.
create or replace function claim_venue(p_venue_id uuid) returns void as $$
declare
  v_acct text;
begin
  select account_type into v_acct from profiles where id = auth.uid();
  if v_acct is distinct from 'business' then
    raise exception 'only business accounts can claim venues';
  end if;
  update venues set business_id = auth.uid()
  where id = p_venue_id and business_id is null;
  if not found then
    raise exception 'venue not found or already claimed';
  end if;
end;
$$ language plpgsql security definer set search_path = public;

-- Business view: bookings across my offers with customer + offer context.
create or replace view business_bookings as
select
  b.*,
  o.business_id,
  o.title as offer_title,
  c.display_name as customer_name
from bookings b
join offers o on o.id = b.offer_id
join profiles c on c.id = b.customer_id;

alter view business_bookings set (security_invoker = true);
grant select on business_bookings to authenticated;

-- ═══════════════════════════════════════════════════════════
-- supabase/migrations/00010_chat_notifications.sql
-- ═══════════════════════════════════════════════════════════
-- Migration 00010 — 1:1 chat, notifications, push tokens.
--
-- Chat is AUTHORIZED: a conversation can only be opened between a post
-- author and an approved participant (post scope), or between a booking's
-- customer and business (booking scope). get_or_create_conversation()
-- enforces this server-side; there is no direct client insert path.
--
-- Notifications are written by security-definer triggers on join_requests,
-- bookings and messages. Remote push delivery goes through the
-- `send-push` edge function (supabase/functions/send-push), invoked by the
-- app after the triggering action; see its README.

-- ── Conversations & messages ──────────────────────────────

-- Replace the milestone-1 thread/message/notification stubs with the real
-- M6 schema. Nothing real exists yet (fresh project), so drop + recreate.
drop table if exists messages cascade;
drop table if exists threads cascade;
drop table if exists notifications cascade;

create table conversations (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  booking_id uuid references bookings(id) on delete cascade,
  user_a uuid not null references profiles(id) on delete cascade,
  user_b uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (post_id is not null or booking_id is not null),
  check (user_a != user_b)
);

-- One conversation per (context, unordered pair).
create unique index conv_post_unique
  on conversations (post_id, user_a, user_b) where booking_id is null;
create unique index conv_booking_unique
  on conversations (booking_id, user_a, user_b) where post_id is null;

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_conv_idx on messages (conversation_id, created_at);

create table conversation_reads (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table conversations enable row level security;
alter table messages enable row level security;
alter table conversation_reads enable row level security;

create policy "members read conversations" on conversations for select
  using (auth.uid() = user_a or auth.uid() = user_b);

create policy "members read messages" on messages for select
  using (exists (
    select 1 from conversations c
    where c.id = messages.conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
  ));

create policy "members send messages" on messages for insert
  with check (
    sender_id = auth.uid() and exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

create policy "users manage own reads" on conversation_reads for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Authorized conversation creation ─────────────────────

create or replace function get_or_create_conversation(
  p_other_user uuid,
  p_post_id uuid default null,
  p_booking_id uuid default null
) returns uuid as $$
declare
  v_me uuid := auth.uid();
  v_a uuid;
  v_b uuid;
  v_conv uuid;
  v_author uuid;
  v_customer uuid;
  v_business uuid;
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;
  if p_other_user = v_me then
    raise exception 'cannot chat with yourself';
  end if;
  if not exists (select 1 from profiles where id = p_other_user) then
    raise exception 'user not found';
  end if;
  if (p_post_id is null) = (p_booking_id is null) then
    raise exception 'provide exactly one of post_id or booking_id';
  end if;

  if p_post_id is not null then
    -- post scope: author <-> approved participant, either direction
    select author_id into v_author from posts where id = p_post_id;
    if not found then
      raise exception 'post not found';
    end if;
    if not (
      (v_author = v_me and exists (
        select 1 from join_requests
        where post_id = p_post_id and requester_id = p_other_user and status = 'approved'))
      or
      (v_author = p_other_user and exists (
        select 1 from join_requests
        where post_id = p_post_id and requester_id = v_me and status = 'approved'))
    ) then
      raise exception 'chat not allowed for this post';
    end if;
  else
    -- booking scope: customer <-> business, either direction
    select b.customer_id, o.business_id into v_customer, v_business
    from bookings b join offers o on o.id = b.offer_id
    where b.id = p_booking_id;
    if not found then
      raise exception 'booking not found';
    end if;
    if not ((v_customer = v_me and v_business = p_other_user)
         or (v_business = v_me and v_customer = p_other_user)) then
      raise exception 'chat not allowed for this booking';
    end if;
  end if;

  -- canonical member ordering so the unique index dedupes both directions
  v_a := least(v_me, p_other_user);
  v_b := greatest(v_me, p_other_user);

  select c.id into v_conv from conversations c
  where c.post_id is not distinct from p_post_id
    and c.booking_id is not distinct from p_booking_id
    and c.user_a = v_a and c.user_b = v_b;

  if v_conv is null then
    begin
      insert into conversations (post_id, booking_id, user_a, user_b)
      values (p_post_id, p_booking_id, v_a, v_b)
      returning id into v_conv;
    exception when unique_violation then
      -- lost a race with another creator; fetch the winner
      select c.id into v_conv from conversations c
      where c.post_id is not distinct from p_post_id
        and c.booking_id is not distinct from p_booking_id
        and c.user_a = v_a and c.user_b = v_b;
    end;
  end if;
  return v_conv;
end;
$$ language plpgsql security definer set search_path = public;

-- ── Chat list with unread counts ──────────────────────────

create or replace function list_my_conversations() returns json as $$
  select coalesce(json_agg(row_to_json(t) order by t.last_at desc nulls last), '[]'::json)
  from (
    select
      c.id,
      case when c.user_a = auth.uid() then c.user_b else c.user_a end as other_user_id,
      p.display_name as other_name,
      c.post_id,
      c.booking_id,
      coalesce(post.title, offer.title) as context_title,
      (select m.body from messages m
        where m.conversation_id = c.id order by m.created_at desc limit 1) as last_body,
      (select m.created_at from messages m
        where m.conversation_id = c.id order by m.created_at desc limit 1) as last_at,
      (select count(*) from messages m
        where m.conversation_id = c.id
          and m.sender_id != auth.uid()
          and m.created_at > coalesce((
            select r.last_read_at from conversation_reads r
            where r.conversation_id = c.id and r.user_id = auth.uid()
          ), '1970-01-01'::timestamptz)) as unread_count
    from conversations c
    join profiles p
      on p.id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
    left join posts post on post.id = c.post_id
    left join bookings b on b.id = c.booking_id
    left join offers offer on offer.id = b.offer_id
    where c.user_a = auth.uid() or c.user_b = auth.uid()
  ) t;
$$ language sql security definer set search_path = public;

create or replace function mark_conversation_read(p_conversation_id uuid) returns void as $$
begin
  if not exists (
    select 1 from conversations
    where id = p_conversation_id
      and (user_a = auth.uid() or user_b = auth.uid())
  ) then
    raise exception 'not a conversation member';
  end if;
  insert into conversation_reads (conversation_id, user_id, last_read_at)
  values (p_conversation_id, auth.uid(), now())
  on conflict (conversation_id, user_id) do update set last_read_at = now();
end;
$$ language plpgsql security definer set search_path = public;

-- ── Push tokens ───────────────────────────────────────────

create table push_tokens (
  user_id uuid not null references profiles(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('android', 'ios')),
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

alter table push_tokens enable row level security;

create policy "users manage own tokens" on push_tokens for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── In-app notifications ──────────────────────────────────

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in (
    'join_request', 'request_approved', 'request_declined',
    'booking', 'booking_confirmed', 'booking_cancelled', 'message'
  )),
  title text not null,
  body text not null,
  ref_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id, created_at desc);

alter table notifications enable row level security;

create policy "users read own notifications" on notifications for select
  using (auth.uid() = user_id);

create policy "users mark own notifications read" on notifications for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Event -> notification writers (security definer: only triggers write).

create or replace function notify_join_request() returns trigger as $$
declare
  v_title text;
  v_body text;
  v_user uuid;
  v_kind text;
begin
  if tg_op = 'INSERT' then
    v_kind := 'join_request';
    select p.author_id into v_user from posts p where p.id = new.post_id;
    select 'New join request',
           pr.display_name || ' wants to join "' || p.title || '"'
      into v_title, v_body
    from profiles pr, posts p
    where pr.id = new.requester_id and p.id = new.post_id;
  elsif tg_op = 'UPDATE' and new.status = 'approved' and old.status is distinct from 'approved' then
    v_kind := 'request_approved';
    v_user := new.requester_id;
    select 'Request approved', 'You''re in! "' || p.title || '"'
      into v_title, v_body from posts p where p.id = new.post_id;
  elsif tg_op = 'UPDATE' and new.status = 'declined' and old.status is distinct from 'declined' then
    v_kind := 'request_declined';
    v_user := new.requester_id;
    select 'Request declined', '"' || p.title || '" didn''t work out this time'
      into v_title, v_body from posts p where p.id = new.post_id;
  else
    return new;
  end if;

  insert into notifications (user_id, kind, title, body, ref_id)
  values (v_user, v_kind, v_title, v_body, new.post_id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notify_join_request on join_requests;
create trigger trg_notify_join_request
  after insert or update of status on join_requests
  for each row execute function notify_join_request();

create or replace function notify_booking() returns trigger as $$
declare
  v_title text;
  v_body text;
  v_user uuid;
  v_kind text;
begin
  if tg_op = 'INSERT' then
    v_kind := 'booking';
    select o.business_id into v_user from offers o where o.id = new.offer_id;
    select 'New booking',
           pr.display_name || ' booked ' || new.party_size || ' seat(s) for "' || o.title || '"'
      into v_title, v_body
    from profiles pr, offers o
    where pr.id = new.customer_id and o.id = new.offer_id;
  elsif tg_op = 'UPDATE' and new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    v_kind := 'booking_confirmed';
    v_user := new.customer_id;
    select 'Booking confirmed', '"' || o.title || '" — see you there'
      into v_title, v_body from offers o where o.id = new.offer_id;
  elsif tg_op = 'UPDATE' and new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    v_kind := 'booking_cancelled';
    -- notify the other party, whoever cancelled
    select case when new.customer_id = auth.uid() then o.business_id else new.customer_id end
      into v_user from offers o where o.id = new.offer_id;
    select 'Booking cancelled', '"' || o.title || '" was cancelled'
      into v_title, v_body from offers o where o.id = new.offer_id;
  else
    return new;
  end if;

  insert into notifications (user_id, kind, title, body, ref_id)
  values (v_user, v_kind, v_title, v_body, new.offer_id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notify_booking on bookings;
create trigger trg_notify_booking
  after insert or update of status on bookings
  for each row execute function notify_booking();

create or replace function notify_message() returns trigger as $$
declare
  v_user uuid;
  v_name text;
begin
  select case when c.user_a = new.sender_id then c.user_b else c.user_a end
    into v_user from conversations c where c.id = new.conversation_id;
  select display_name into v_name from profiles where id = new.sender_id;
  insert into notifications (user_id, kind, title, body, ref_id)
  values (v_user, 'message', 'Message from ' || coalesce(v_name, 'someone'),
          left(new.body, 140), new.conversation_id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notify_message on messages;
create trigger trg_notify_message
  after insert on messages
  for each row execute function notify_message();

