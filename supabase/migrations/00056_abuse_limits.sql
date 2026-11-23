begin;
-- Spam and abuse limits enforced by the database, so they also hold for
-- anyone calling the API directly instead of using the app.

-- One rate check for every user-written table. Arguments: the column holding
-- the writer's id, the window, the most writes allowed in it, and the message.
-- Only writes made for a signed-in user are counted; workers, admins and
-- migrations (no auth.uid()) are not limited.
create function public.enforce_write_rate() returns trigger as $$
declare
 actor uuid;
 recent int;
 lim int = tg_argv[2]::int;
begin
 actor = nullif(to_jsonb(new)->>tg_argv[0],'')::uuid;
 if auth.uid() is null or actor is distinct from auth.uid() then return new; end if;
 -- Clients can't backdate a row to slip outside the window.
 if to_jsonb(new) ? 'created_at' then new.created_at = now(); end if;
 -- One writer at a time per table, so parallel requests can't overshoot.
 perform pg_advisory_xact_lock(hashtextextended('nearry-rate:'||tg_table_name||':'||actor::text,0));
 execute format('select count(*) from %I.%I where %I=$1 and created_at>now()-$2::interval',
   tg_table_schema, tg_table_name, tg_argv[0])
   into recent using actor, tg_argv[1];
 if recent >= lim then raise exception '%', tg_argv[3] using errcode = 'P0001'; end if;
 return new;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.enforce_write_rate() from public,anon,authenticated;

create trigger rate_limit_posts before insert on public.posts for each row
 execute function public.enforce_write_rate('author_id','24 hours','10','You can post up to 10 plans a day. Try again tomorrow.');
create trigger rate_limit_join_requests before insert on public.join_requests for each row
 execute function public.enforce_write_rate('requester_id','1 hour','40','You''ve sent a lot of join requests. Try again in an hour.');
create trigger rate_limit_messages before insert on public.messages for each row
 execute function public.enforce_write_rate('sender_id','1 minute','30','Slow down: you''re sending messages too quickly.');
create trigger rate_limit_offers before insert on public.offers for each row
 execute function public.enforce_write_rate('business_id','24 hours','30','You can create up to 30 offers a day. Try again tomorrow.');

-- The counts above read these.
create index if not exists messages_sender_time on public.messages(sender_id,created_at desc);
create index if not exists offers_business_time on public.offers(business_id,created_at desc);

-- Profile text can be edited directly, so it needs limits of its own. They
-- are looser than the app's (names come from Google, which can be long).
alter table public.profiles
 add constraint profiles_display_name_length check (display_name is null or char_length(display_name) <= 100),
 add constraint profiles_business_name_length check (business_name is null or char_length(business_name) <= 120),
 add constraint profiles_bio_length check (bio is null or char_length(bio) <= 500);

-- Uploads: only the image types the app sends, up to 10 MB (the app's own cap).
update storage.buckets
 set file_size_limit = 10485760, allowed_mime_types = array['image/jpeg','image/png','image/webp']
 where id in ('avatars','photos','verification_docs');

-- Signed-out visitors don't need these.
revoke execute on function public.account_active(uuid), public.approved_join_count(uuid),
 public.content_visible(text,uuid), public.visible_author(uuid), public.my_offer_booking(uuid) from anon;
revoke all on public.push_tokens from anon;
-- Messages are never edited by users; there is no update policy, so drop the grant too.
revoke update on public.messages from authenticated;

notify pgrst,'reload schema';
commit;
