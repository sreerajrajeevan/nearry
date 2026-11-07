-- Migration 00028 — preserve saved audiences when reading published posts.
-- SELECT p.* in the original view was expanded before gender_preference was
-- added in 00021; inserting/editing posts saved it, but reading the view lost it.
begin;

-- Keep every existing view column in its original position and append the new
-- field. This preserves dependent objects and grants without dropping the view.
create or replace view public.post_cards with (security_invoker = true) as
select
  p.id,
  p.author_id,
  p.title,
  p.description,
  p.venue_id,
  p.venue_name,
  p.starts_at,
  p.vacancies,
  p.tags,
  p.status,
  p.created_at,
  p.expires_at,
  p.cost_cents,
  pr.display_name as author_name,
  public.approved_join_count(p.id) as approved_count,
  p.gender_preference
from public.posts p
join public.profiles pr on pr.id = p.author_id;

-- Refresh PostgREST's schema cache so existing clients see the field promptly.
notify pgrst, 'reload schema';
commit;
