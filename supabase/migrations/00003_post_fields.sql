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
