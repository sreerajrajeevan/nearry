begin;
-- Performance tidy-up from the Supabase advisor.

-- 1) Row-security rules: wrap auth.uid() in a sub-select so Postgres reads the
--    signed-in user once per query instead of once per row. Same meaning;
--    already-wrapped calls are left alone.
do $$
declare p record; using_expr text; check_expr text; stmt text;
begin
 for p in select schemaname, tablename, policyname, qual, with_check from pg_policies
  where schemaname = 'public'
 loop
  using_expr = regexp_replace(p.qual, '(?<!select )auth\.uid\(\)', '(select auth.uid())', 'gi');
  check_expr = regexp_replace(p.with_check, '(?<!select )auth\.uid\(\)', '(select auth.uid())', 'gi');
  if using_expr is not distinct from p.qual and check_expr is not distinct from p.with_check then continue; end if;
  stmt = format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  if p.qual is not null then stmt = stmt || format(' using (%s)', using_expr); end if;
  if p.with_check is not null then stmt = stmt || format(' with check (%s)', check_expr); end if;
  execute stmt;
 end loop;
end $$;

-- 2) Foreign keys used for lookups and for account removal.
create index if not exists admin_console_audit_actor on public.admin_console_audit(actor_id);
create index if not exists content_reports_subject_user on public.content_reports(subject_user_id);
create index if not exists conversation_clears_user on public.conversation_clears(user_id);
create index if not exists conversation_reads_user on public.conversation_reads(user_id);
create index if not exists notifications_message on public.notifications(message_id);
create index if not exists offers_venue on public.offers(venue_id);
create index if not exists plan_group_reads_user on public.plan_group_reads(user_id);
create index if not exists posts_venue on public.posts(venue_id);
create index if not exists venues_business on public.venues(business_id);
create index if not exists verification_review_jobs_user on public.verification_review_jobs(user_id);
-- Tables that only exist on projects upgraded from the first schema.
do $$begin
 if to_regclass('public.legacy_messages') is not null then
  create index if not exists legacy_messages_sender on public.legacy_messages(sender_id);
  create index if not exists legacy_messages_thread on public.legacy_messages(thread_id);
 end if;
 if to_regclass('public.legacy_notifications') is not null then
  create index if not exists legacy_notifications_user on public.legacy_notifications(user_id);
 end if;
 if to_regclass('public.legacy_threads') is not null then
  create index if not exists legacy_threads_booking on public.legacy_threads(booking_id);
 end if;
end$$;
commit;
