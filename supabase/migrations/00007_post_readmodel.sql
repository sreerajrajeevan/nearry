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
