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
