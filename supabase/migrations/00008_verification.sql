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
