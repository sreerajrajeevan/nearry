-- Migration 00023 — visual richness: photos, amenities, spotlight offers.
-- Run once in the Supabase dashboard SQL editor.
begin;

-- Venue photo gallery (multiple photos per venue).
create table if not exists public.venue_photos (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  photo_url text not null,
  sort_order int not null default 0,
  created_at timestamptz default now()
);
create index if not exists venue_photos_venue_idx on public.venue_photos(venue_id);

-- Post photos (personal need-a-player posts).
create table if not exists public.post_photos (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  photo_url text not null,
  sort_order int not null default 0,
  created_at timestamptz default now()
);
create index if not exists post_photos_post_idx on public.post_photos(post_id);

-- Amenities on venues (free-form text array; app provides presets).
alter table public.venues add column if not exists amenities text[] not null default '{}';

-- Offer cover photo + spotlight flag.
alter table public.offers add column if not exists cover_photo_url text;
alter table public.offers add column if not exists is_spotlight boolean not null default false;

-- Public read; owners write.
alter table public.venue_photos enable row level security;
alter table public.post_photos enable row level security;

drop policy if exists "venue photos public read" on public.venue_photos;
create policy "venue photos public read" on public.venue_photos
  for select using (true);

drop policy if exists "venue owners manage photos" on public.venue_photos;
create policy "venue owners manage photos" on public.venue_photos
  for all using (
    exists (
      select 1 from public.venues v
      where v.id = venue_photos.venue_id and v.business_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.venues v
      where v.id = venue_photos.venue_id and v.business_id = auth.uid()
    )
  );

drop policy if exists "post photos public read" on public.post_photos;
create policy "post photos public read" on public.post_photos
  for select using (true);

drop policy if exists "post owners manage photos" on public.post_photos;
create policy "post owners manage photos" on public.post_photos
  for all using (
    exists (
      select 1 from public.posts p
      where p.id = post_photos.post_id and p.author_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.posts p
      where p.id = post_photos.post_id and p.author_id = auth.uid()
    )
  );

-- Public photos bucket (venue galleries, post photos, offer covers).
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists "photos public read" on storage.objects;
create policy "photos public read" on storage.objects
  for select using (bucket_id = 'photos');

drop policy if exists "users upload own photos" on storage.objects;
create policy "users upload own photos" on storage.objects
  for insert with check (
    bucket_id = 'photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "users delete own photos" on storage.objects;
create policy "users delete own photos" on storage.objects
  for delete using (
    bucket_id = 'photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

commit;
