-- New posts must have a selected venue or a named, coordinate-confirmed spot.
-- An INSERT trigger preserves all existing posts and their lifecycle/history.
begin;
create function public.require_post_meeting_place() returns trigger as $$
begin
 if new.venue_id is null and (
   char_length(btrim(coalesce(new.venue_name,''))) not between 1 and 120
   or new.location_lat is null or new.location_lng is null
 ) then
  raise exception 'Select a meeting place or add a place with coordinates before publishing.';
 end if;
 return new;
end;
$$ language plpgsql set search_path=public,pg_temp;
revoke all on function public.require_post_meeting_place() from public,anon,authenticated;
-- Run after profile/audience/coordinate guards so their existing errors remain useful.
create trigger zz_require_post_meeting_place before insert on public.posts
 for each row execute function public.require_post_meeting_place();
notify pgrst,'reload schema';
commit;
