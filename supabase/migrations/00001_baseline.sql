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
