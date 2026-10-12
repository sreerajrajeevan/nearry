-- Forward migration: existing rows are preserved. Apply after 00010.
begin;

-- Client access to private profile columns is through get_my_profile only.
revoke select, insert, update, delete on profiles from anon, authenticated;
grant select (id, display_name, avatar_url, bio, business_name, verification_status) on profiles to anon, authenticated;
grant update (display_name, avatar_url, bio, interests, business_name, business_details, onboarding_completed) on profiles to authenticated;
alter table profiles add column if not exists role_selected boolean not null default true;
-- Existing onboarded accounts retain their role. Incomplete accounts can confirm it.
update profiles set role_selected = onboarding_completed;
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, account_type, display_name, role_selected)
  values (new.id,
    case when new.raw_user_meta_data ->> 'account_type' = 'business' then 'business' else 'personal' end,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), 'user'),
    coalesce(new.raw_user_meta_data ->> 'account_type' in ('personal', 'business'),false));
  return new;
end;
$$ language plpgsql security definer set search_path = public;
-- NULL metadata is normalized explicitly.
create or replace function get_my_profile() returns jsonb as $$
  select to_jsonb(p) from profiles p where p.id = auth.uid();
$$ language sql security definer set search_path = public;
create or replace function select_account_type(p_account_type text) returns void as $$
declare p profiles;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_account_type is null or p_account_type not in ('personal','business') then raise exception 'invalid account type'; end if;
  select * into p from profiles where id = auth.uid() for update;
  if not found then raise exception 'profile not found'; end if;
  if p.onboarding_completed or p.role_selected then
    if p.account_type <> p_account_type then raise exception 'account type is already selected'; end if;
    return;
  end if;
  if p.account_type=p_account_type then update profiles set role_selected=true where id=p.id;return;end if;
  if p.verification_status <> 'unverified' or exists(select 1 from offers where business_id = p.id)
    or exists(select 1 from posts where author_id = p.id) then raise exception 'account type cannot change'; end if;
  update profiles set account_type = p_account_type, role_selected = true where id = p.id;
end;
$$ language plpgsql security definer set search_path = public;
-- Private proof submission is an authorized RPC, not a client status update.
create or replace function submit_verification(p_path text) returns void as $$
declare p profiles;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into p from profiles where id = auth.uid() for update;
  if p.account_type <> 'business' or p.verification_status not in ('unverified','rejected') then raise exception 'verification cannot be submitted'; end if;
  if p_path is null or split_part(p_path, '/', 1) <> auth.uid()::text or not exists(
    select 1 from storage.objects where bucket_id = 'verification_docs' and name = p_path
  ) then raise exception 'upload your proof document first'; end if;
  update profiles set verification_doc_path = p_path, verification_status = 'pending' where id = p.id;
end;
$$ language plpgsql security definer set search_path = public;
-- Grants protect role and verification; owner onboarding writes are validated.
create or replace function protect_profile_fields() returns trigger as $$
begin
  if current_user in ('anon','authenticated') then
    if new.account_type is distinct from old.account_type or new.role_selected is distinct from old.role_selected
      or new.verification_status is distinct from old.verification_status
      or new.verification_doc_path is distinct from old.verification_doc_path then raise exception 'protected profile field'; end if;
    if new.onboarding_completed and (not new.role_selected or char_length(btrim(new.display_name)) < 2
      or (new.account_type = 'business' and (char_length(btrim(coalesce(new.business_name,''))) < 2
        or coalesce(new.business_details->>'category','') = '' or coalesce(new.business_details->>'area','') = '')))
      then raise exception 'complete your profile before onboarding'; end if;
  end if;
  return new;
end;
$$ language plpgsql;
-- Seeded venue ownership must be reviewed by an administrator.
create or replace function claim_venue(p_venue_id uuid) returns void as $$
begin raise exception 'Venue ownership requires administrator review. Submit your business proof first.'; end;
$$ language plpgsql security definer set search_path = public;
revoke insert, update, delete on venues from anon, authenticated;

-- Join requests are mutated only through locked, authorized RPCs.
revoke insert, update, delete on join_requests from anon, authenticated;
create or replace function request_join(p_post_id uuid) returns jsonb as $$
declare p posts; r join_requests;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from profiles where id = auth.uid() and account_type = 'personal' and onboarding_completed) then raise exception 'personal onboarding required'; end if;
  select * into p from posts where id = p_post_id for update;
  if not found or p.author_id = auth.uid() then raise exception 'post not found or cannot join your own post'; end if;
  if p.status <> 'open' or coalesce(p.expires_at,p.starts_at) <= now() or p.starts_at <= now() then raise exception 'post is closed or expired'; end if;
  if (select count(*) from join_requests where post_id=p.id and status='approved') >= p.vacancies then raise exception 'post is full'; end if;
  select * into r from join_requests where post_id=p.id and requester_id=auth.uid() for update;
  if found and r.status in ('pending','approved') then raise exception 'you already requested or joined this post'; end if;
  if r.id is null then
    insert into join_requests(post_id,requester_id,status) values(p.id,auth.uid(),'pending') returning * into r;
  else
    update join_requests set status='pending',created_at=now() where id=r.id returning * into r;
  end if;
  return to_jsonb(r);
end;
$$ language plpgsql security definer set search_path=public;
-- Post-first lock ordering is shared by request, approval, withdrawal and host edits.
create or replace function approve_join_request(p_request_id uuid) returns json as $$
declare p posts; r join_requests; pid uuid; taken int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select post_id into pid from join_requests where id=p_request_id;
  select * into p from posts where id=pid for update;
  if not found or p.author_id is distinct from auth.uid() then raise exception 'only the host can approve requests'; end if;
  select * into r from join_requests where id=p_request_id and post_id=p.id for update;
  if not found or r.status <> 'pending' then raise exception 'request is not pending'; end if;
  if r.requester_id=p.author_id then raise exception 'cannot join your own post'; end if;
  if p.status <> 'open' or coalesce(p.expires_at,p.starts_at)<=now() or p.starts_at<=now() then raise exception 'post is closed or expired'; end if;
  select count(*) into taken from join_requests where post_id=p.id and status='approved';
  if taken>=p.vacancies then raise exception 'post is full'; end if;
  update join_requests set status='approved' where id=r.id;
  if taken+1>=p.vacancies then update posts set status='closed' where id=p.id; end if;
  return json_build_object('spots_left',p.vacancies-taken-1,'post_closed',taken+1>=p.vacancies);
end;
$$ language plpgsql security definer set search_path=public;
create or replace function withdraw_join_request(p_request_id uuid) returns void as $$
declare p posts; r join_requests; pid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select post_id into pid from join_requests where id=p_request_id;
  select * into p from posts where id=pid for update;
  select * into r from join_requests where id=p_request_id for update;
  if not found or r.requester_id is distinct from auth.uid() then raise exception 'only the participant can withdraw'; end if;
  if r.status='withdrawn' then return; end if;
  if r.status not in ('pending','approved') then raise exception 'request cannot be withdrawn'; end if;
  update join_requests set status='withdrawn' where id=r.id;
end;
$$ language plpgsql security definer set search_path=public;
create or replace function decline_join_request(p_request_id uuid) returns void as $$
declare p posts; r join_requests; pid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select post_id into pid from join_requests where id=p_request_id;
  select * into p from posts where id=pid for update;
  if not found or p.author_id is distinct from auth.uid() then raise exception 'only the host can decline'; end if;
  select * into r from join_requests where id=p_request_id for update;
  if not found or r.status <> 'pending' then raise exception 'request is not pending'; end if;
  update join_requests set status='declined' where id=r.id;
end;
$$ language plpgsql security definer set search_path=public;
create or replace function reopen_post_if_space() returns trigger as $$
declare p posts;
begin
  if old.status <> 'approved' then return coalesce(new,old); end if;
  if tg_op='UPDATE' and new.status='approved' then return new; end if;
  select * into p from posts where id=old.post_id for update;
  if p.status='closed' and coalesce(p.expires_at,p.starts_at)>now() and p.starts_at>now()
    and (select count(*) from join_requests where post_id=p.id and status='approved')<p.vacancies then
    update posts set status='open' where id=p.id;
  end if;
  return coalesce(new,old);
end;
$$ language plpgsql security definer set search_path=public;
-- Counts expose only a number; private participant rows still use RLS.
create or replace function approved_join_count(p_post_id uuid) returns int as $$
  select count(*)::int from join_requests where post_id=p_post_id and status='approved';
$$ language sql stable security definer set search_path=public;
create or replace view post_cards with (security_invoker=true) as
select p.*,pr.display_name as author_name,approved_join_count(p.id) as approved_count
from posts p join profiles pr on pr.id=p.author_id;

-- Protect every post mutation, including status-only writes and ownership.
revoke update, delete on posts from anon,authenticated;
grant update(title,description,venue_id,venue_name,starts_at,expires_at,vacancies,cost_cents,tags) on posts to authenticated;
create or replace function guard_post_edit() returns trigger as $$
declare taken int;
begin
  if tg_op='UPDATE' then
    if new.author_id is distinct from old.author_id then raise exception 'post ownership cannot change'; end if;
    if current_user='authenticated' then
      if old.author_id is distinct from auth.uid() or old.status<>'open' then raise exception 'only the host can edit open posts'; end if;
    end if;
    -- Lifecycle RPCs may update status without revalidating old form fields.
    if row(new.title,new.description,new.venue_id,new.venue_name,new.starts_at,new.expires_at,new.vacancies,new.cost_cents,new.tags)
      is not distinct from row(old.title,old.description,old.venue_id,old.venue_name,old.starts_at,old.expires_at,old.vacancies,old.cost_cents,old.tags) then return new; end if;
  end if;
  if char_length(btrim(new.title)) not between 4 and 80 or char_length(btrim(new.description)) not between 10 and 1000
    or new.vacancies not between 1 and 100 or new.starts_at<=now()+interval '15 minutes'
    or (new.expires_at is not null and (new.expires_at<=now() or new.expires_at>=new.starts_at)) then raise exception 'invalid post details'; end if;
  if current_user='authenticated' and not exists(select 1 from profiles where id=auth.uid() and account_type='personal' and onboarding_completed) then raise exception 'personal onboarding required'; end if;
  select count(*) into taken from join_requests where post_id=new.id and status='approved';
  if new.vacancies<taken then raise exception 'vacancies cannot be below approved count'; end if;
  if taken>=new.vacancies then new.status='closed'; end if;
  return new;
end;
$$ language plpgsql;
drop trigger if exists trg_guard_post_edit on posts;
create trigger trg_guard_post_edit before insert or update on posts for each row execute function guard_post_edit();
create or replace function cancel_post(p_post_id uuid) returns void as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update posts set status='cancelled' where id=p_post_id and author_id=auth.uid() and status in ('open','closed') and starts_at>now();
  if not found then raise exception 'post not found, already cancelled, or not yours'; end if;
end;
$$ language plpgsql security definer set search_path=public;
create or replace function close_expired_posts() returns int as $$
declare n int;
begin
  update posts set status='closed' where status='open' and coalesce(expires_at,starts_at)<=now();
  get diagnostics n=row_count;return n;
end;
$$ language plpgsql security definer set search_path=public;

-- Emit a public post change when private participation changes. No participant data leaks.
create or replace function refresh_post_capacity_event() returns trigger as $$
begin
 if (tg_op='INSERT' and new.status='approved') or
   (tg_op='UPDATE' and (new.status='approved' or old.status='approved')) then
   update posts set status=status where id=new.post_id;
 elsif tg_op='DELETE' and old.status='approved' then update posts set status=status where id=old.post_id; end if;
 return coalesce(new,old);
end;
$$ language plpgsql security definer set search_path=public;
create trigger trg_refresh_post_capacity_event after insert or update of status or delete on join_requests
 for each row execute function refresh_post_capacity_event();

-- Remove raw booking mutation paths, including customer self-confirmation.
revoke insert,update,delete on bookings from anon,authenticated;
create or replace function change_booking_status(p_booking_id uuid,p_status text) returns void as $$
declare b bookings; o offers; oid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select offer_id into oid from bookings where id=p_booking_id;
  select * into o from offers where id=oid for update;
  select * into b from bookings where id=p_booking_id for update;
  if not found or (b.customer_id is distinct from auth.uid() and o.business_id is distinct from auth.uid()) then raise exception 'not your booking'; end if;
  if p_status='confirmed' then
    if o.business_id is distinct from auth.uid() then raise exception 'only the business can confirm'; end if;
    if b.status<>'pending' or b.slot<=now() or o.status<>'live' then raise exception 'booking cannot be confirmed'; end if;
  elsif p_status='cancelled' then
    if b.status='cancelled' then return; end if;
  else raise exception 'invalid booking transition'; end if;
  update bookings set status=p_status where id=b.id;
end;
$$ language plpgsql security definer set search_path=public;

-- A narrow grant list rather than PostgreSQL's default PUBLIC execution.
revoke execute on function get_my_profile(),select_account_type(text),submit_verification(text),claim_venue(uuid),
 request_join(uuid),approve_join_request(uuid),withdraw_join_request(uuid),decline_join_request(uuid),
 cancel_post(uuid),close_expired_posts(),change_booking_status(uuid,text),create_booking(uuid,timestamptz,int),
 get_or_create_conversation(uuid,uuid,uuid),list_my_conversations(),mark_conversation_read(uuid) from public,anon,authenticated;
grant execute on function get_my_profile(),select_account_type(text),submit_verification(text),claim_venue(uuid),
 request_join(uuid),approve_join_request(uuid),withdraw_join_request(uuid),decline_join_request(uuid),cancel_post(uuid),
 change_booking_status(uuid,text),create_booking(uuid,timestamptz,int),get_or_create_conversation(uuid,uuid,uuid),
 list_my_conversations(),mark_conversation_read(uuid) to authenticated;
grant execute on function close_expired_posts() to service_role;
revoke execute on function approved_join_count(uuid) from public;
grant execute on function approved_join_count(uuid) to anon,authenticated;
-- Notification contents are server-owned. The client can only mark read.
revoke update on notifications from anon,authenticated;
grant update(read_at) on notifications to authenticated;
commit;
