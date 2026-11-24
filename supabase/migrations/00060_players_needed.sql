-- Players needed: notification switches, a kept alert area, urgent plans that
-- alert nearby people, and auto-accept.
--
-- Additive: new columns default to "off"/"all on", RPC results only gain keys,
-- so older app builds keep working. Requires 00049.

-- ── Part 1: notification switches and the alert area ─────────────────────

create function valid_notification_settings(v jsonb) returns boolean
language sql immutable set search_path=public,pg_temp as $$
  select coalesce(
    jsonb_typeof(v) = 'object'
    and not exists (
      select 1 from jsonb_each(v) e
      where e.key not in ('messages','plans','bookings','nearby')
         or jsonb_typeof(e.value) <> 'boolean'),
    false)
$$;
revoke all on function valid_notification_settings(jsonb) from public, anon;
grant execute on function valid_notification_settings(jsonb) to authenticated, service_role;

alter table profiles add column notification_settings jsonb not null default '{}'::jsonb
  check (valid_notification_settings(notification_settings));
-- Owners read it through get_notification_preferences(); nobody else sees it.
revoke select(notification_settings) on profiles from anon, authenticated;

-- Which switch a notification kind belongs to; null = always delivered
-- (account notices such as verification results).
create function notification_category(p_kind text) returns text
language sql immutable set search_path=public,pg_temp as $$
  select case
    when p_kind in ('message','plan_group_message') then 'messages'
    when p_kind in ('join_request','request_approved','request_declined','request_full','post_cancelled','plan_reminder') then 'plans'
    when p_kind in ('booking','booking_confirmed','booking_cancelled') then 'bookings'
    when p_kind = 'nearby_plan' then 'nearby'
  end
$$;

create function notification_category_enabled(p_user uuid, p_kind text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select notification_category(p_kind) is null
    or coalesce((select p.notification_settings->>notification_category(p_kind)
                 from profiles p where p.id = p_user), 'true') <> 'false'
$$;
revoke all on function notification_category(text), notification_category_enabled(uuid,text)
  from public, anon, authenticated;

create or replace function queue_notification_push() returns trigger as $$
begin
 if exists(select 1 from profiles where id=new.user_id and push_enabled)
    and notification_allowed(new.user_id,new.kind,new.ref_id)
    and notification_category_enabled(new.user_id,new.kind) then
  insert into push_jobs(notification_id) values(new.id) on conflict do nothing;
 end if;
 return new;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;

create or replace function get_notification_preferences() returns jsonb as $$
 select jsonb_build_object(
   'pushEnabled', push_enabled,
   'messages', coalesce(notification_settings->>'messages','true') <> 'false',
   'plans', coalesce(notification_settings->>'plans','true') <> 'false',
   'bookings', coalesce(notification_settings->>'bookings','true') <> 'false',
   'nearby', coalesce(notification_settings->>'nearby','true') <> 'false',
   'alertArea', case when onboarding_preferences ? 'area'
     then jsonb_build_object('label', onboarding_preferences#>>'{area,label}') end)
 from profiles where id = auth.uid();
$$ language sql stable security definer set search_path=public,pg_temp;

create function set_notification_category(p_category text, p_enabled boolean) returns void as $$
begin
 if p_category is null or p_category not in ('messages','plans','bookings','nearby') or p_enabled is null then
  raise exception 'unknown notification category';
 end if;
 if not account_active(auth.uid()) then raise exception 'account unavailable'; end if;
 update profiles set notification_settings = notification_settings || jsonb_build_object(p_category, p_enabled)
  where id = auth.uid();
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function set_notification_category(text,boolean) from public, anon;
grant execute on function set_notification_category(text,boolean) to authenticated;

-- The area people chose at sign-up (or later in settings) is where nearby
-- alerts are aimed. It is kept until they change or remove it.
create function set_alert_area(p_area jsonb) returns void as $$
begin
 if not account_active(auth.uid()) then raise exception 'account unavailable'; end if;
 if p_area is null or p_area = 'null'::jsonb then
  update profiles set onboarding_preferences = onboarding_preferences - 'area' where id = auth.uid();
  return;
 end if;
 if not valid_onboarding_preferences(jsonb_build_object('area', p_area)) then
  raise exception 'Invalid area';
 end if;
 update profiles set onboarding_preferences = onboarding_preferences || jsonb_build_object('area', p_area)
  where id = auth.uid();
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function set_alert_area(jsonb) from public, anon;
grant execute on function set_alert_area(jsonb) to authenticated;

-- A GPS fix is often someone's home: keep it to about 1 km.
create function round_device_area() returns trigger as $$
begin
 if new.onboarding_preferences#>>'{area,source}' = 'device'
    and jsonb_typeof(new.onboarding_preferences#>'{area,latitude}') = 'number'
    and jsonb_typeof(new.onboarding_preferences#>'{area,longitude}') = 'number' then
  new.onboarding_preferences := jsonb_set(jsonb_set(new.onboarding_preferences,
    '{area,latitude}', to_jsonb(round((new.onboarding_preferences#>>'{area,latitude}')::numeric, 2))),
    '{area,longitude}', to_jsonb(round((new.onboarding_preferences#>>'{area,longitude}')::numeric, 2)));
 end if;
 return new;
end;
$$ language plpgsql set search_path=public,pg_temp;
revoke all on function round_device_area() from public, anon, authenticated;
create trigger round_device_area before insert or update of onboarding_preferences on profiles
 for each row execute function round_device_area();
-- Round the GPS areas already saved.
update profiles set onboarding_preferences = onboarding_preferences
 where onboarding_preferences#>>'{area,source}' = 'device';

-- Stop the 29-day deletion of the area (business coordinates keep theirs).
create or replace function maintenance_retention_before_selfie_poses() returns void as $$
begin
 perform maintenance_retention_before_onboarding();
 update profiles set business_details=business_details-array['latitude','longitude','locationCachedAt']
  where business_details->>'locationSource'='google'
    and (business_details ? 'latitude' or business_details ? 'longitude')
    and onboarding_location_expired(business_details->>'locationCachedAt');
end;
$$ language plpgsql security definer set search_path=public,pg_temp;

alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check check (kind in (
  'join_request','request_approved','request_declined','request_full','post_cancelled',
  'booking','booking_confirmed','booking_cancelled','message','verification_approved',
  'verification_rejected','selfie_review','plan_group_message','plan_reminder','nearby_plan'));

-- ── Part 2: urgent plans, nearby alerts, auto-accept ────────────────────

alter table posts add column urgent boolean not null default false;
alter table posts add column auto_accept boolean not null default false;
grant insert(urgent, auto_accept) on posts to authenticated;

-- Same read model as 00036, with the two new flags appended.
create or replace view public.post_cards with (security_invoker=true) as
 select p.id,p.author_id,p.title,p.description,p.venue_id,p.venue_name,p.starts_at,p.vacancies,p.tags,p.status,p.created_at,
 p.expires_at,p.cost_cents,pr.display_name as author_name,public.approved_join_count(p.id) as approved_count,p.gender_preference,
 case when p.location_source<>'google' or p.location_cached_at>now()-interval '29 days' then p.location_lat end as location_lat,
 case when p.location_source<>'google' or p.location_cached_at>now()-interval '29 days' then p.location_lng end as location_lng,
 p.location_source,p.location_place_id,p.location_cached_at,p.plan_details,p.urgent,p.auto_accept
 from public.posts p join public.profiles pr on pr.id=p.author_id;

-- Great-circle distance in km (no PostGIS needed).
create function km_between(a_lat double precision, a_lng double precision, b_lat double precision, b_lng double precision)
returns double precision language sql immutable set search_path=public,pg_temp as $$
  select 6371.0088 * 2 * asin(least(1, sqrt(
    power(sin(radians(b_lat - a_lat) / 2), 2)
    + cos(radians(a_lat)) * cos(radians(b_lat)) * power(sin(radians(b_lng - a_lng) / 2), 2))))
$$;

-- Where a plan meets: its own spot, else its Nearry venue.
create function plan_coordinates(p_post uuid, out lat double precision, out lng double precision) as $$
declare v venues; v_venue uuid;
begin
 select p.location_lat, p.location_lng, p.venue_id into lat, lng, v_venue from posts p where p.id = p_post;
 if lat is not null and lng is not null then return; end if;
 lat := null; lng := null;
 select * into v from venues where id = v_venue;
 if not found then return; end if;
 if v.location_lat is not null and v.location_lng is not null then
  lat := v.location_lat; lng := v.location_lng; return;
 end if;
 if v.location is not null then
  -- Older venues only have the PostGIS point.
  execute 'select st_y($1::geometry), st_x($1::geometry)' into lat, lng using v.location;
 end if;
end;
$$ language plpgsql stable security definer set search_path=public,pg_temp;

create function guard_urgent_plan() returns trigger as $$
declare v_today int;
begin
 if tg_op = 'UPDATE' then
  if new.urgent is distinct from old.urgent or new.auto_accept is distinct from old.auto_accept then
   raise exception 'Urgent and auto-accept can''t be changed after posting';
  end if;
  return new;
 end if;
 if new.urgent then
  if new.starts_at <= now() or new.starts_at > now() + interval '6 hours' then
   raise exception 'Players needed now is only for plans starting within 6 hours';
  end if;
  perform 1 from profiles where id = new.author_id for update;
  select count(*) into v_today from posts
   where author_id = new.author_id and urgent
     and (created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date;
  if v_today >= 2 then raise exception 'You can post 2 urgent plans a day'; end if;
 end if;
 return new;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
create trigger guard_urgent_plan before insert or update of urgent, auto_accept on posts
 for each row execute function guard_urgent_plan();

create function alert_nearby_players() returns trigger as $$
declare pt record; v_place text; v_time text; v_min int; v_max int;
begin
 if not new.urgent then return new; end if;
 select * into pt from plan_coordinates(new.id);
 if pt.lat is null or pt.lng is null then return new; end if;
 v_place := coalesce(nullif(btrim(new.venue_name), ''), (select name from venues where id = new.venue_id), 'the meeting place');
 v_time := to_char(new.starts_at at time zone 'Asia/Kolkata', 'FMHH12:MI AM');
 v_min := coalesce((new.plan_details->>'ageMin')::int, 18);
 v_max := coalesce((new.plan_details->>'ageMax')::int, 100);
 insert into notifications(user_id, kind, title, body, ref_id)
 select c.id, 'nearby_plan', 'Players needed nearby',
   '"' || new.title || '" at ' || v_place || ' · ' || v_time || ' · ' || new.vacancies
   || case when new.vacancies = 1 then ' spot' else ' spots' end || ' · ' || to_char(c.km, 'FM990.0') || ' km',
   new.id
 from (
  select pr.id,
   km_between(pt.lat, pt.lng, (pr.onboarding_preferences#>>'{area,latitude}')::double precision,
              (pr.onboarding_preferences#>>'{area,longitude}')::double precision) as km,
   coalesce((pr.onboarding_preferences->>'radiusKm')::int, 5) as radius
  from profiles pr
  where pr.id <> new.author_id and pr.account_type = 'personal'
   and jsonb_typeof(pr.onboarding_preferences#>'{area,latitude}') = 'number'
   and jsonb_typeof(pr.onboarding_preferences#>'{area,longitude}') = 'number'
   and coalesce(pr.notification_settings->>'nearby', 'true') <> 'false'
   and (new.gender_preference is null or new.gender_preference = 'any' or pr.gender = new.gender_preference)
   and pr.age between v_min and v_max
 ) c
 where c.km <= c.radius
   and personal_profile_ready(c.id)
   and not users_blocked(new.author_id, c.id)
   and (select count(*) from notifications n where n.user_id = c.id and n.kind = 'nearby_plan'
        and (n.created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date) < 3
 order by c.km
 limit 200;
 return new;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
create trigger alert_nearby_players after insert on posts
 for each row when (new.urgent) execute function alert_nearby_players();
revoke all on function km_between(double precision,double precision,double precision,double precision),
  plan_coordinates(uuid), guard_urgent_plan(), alert_nearby_players() from public, anon, authenticated;

create or replace function notification_allowed(p_user uuid, p_kind text, p_ref uuid) returns boolean as $$
 select case
  when p_kind='plan_group_message' then exists(select 1 from plan_group_messages m where m.id=p_ref and plan_group_member(m.group_id,p_user) and account_active(m.sender_id) and not users_blocked(m.sender_id,p_user) and content_visible('plan_message',m.id))
  when p_kind='nearby_plan' then account_active(p_user) and exists(select 1 from posts p where p.id=p_ref and account_active(p.author_id) and not users_blocked(p.author_id,p_user) and content_visible('post',p.id))
  else notification_allowed_before_plan_groups(p_user,p_kind,p_ref) end;
$$ language sql stable security definer set search_path=public,pg_temp;

-- Auto-accept: the request is approved straight away. The existing triggers
-- still enforce audience, age, blocks and capacity, and close the plan when full.
create or replace function public.request_join(p_post_id uuid, p_note text default null) returns jsonb as $$
declare p posts; r join_requests; v_note text := nullif(btrim(p_note), '');
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if char_length(v_note) > 280 then raise exception 'Keep your note under 280 characters'; end if;
  if not exists(select 1 from profiles where id = auth.uid() and account_type = 'personal' and onboarding_completed) then raise exception 'personal onboarding required'; end if;
  select * into p from posts where id = p_post_id for update;
  if not found or p.author_id = auth.uid() then raise exception 'post not found or cannot join your own post'; end if;
  if p.status <> 'open' or coalesce(p.expires_at,p.starts_at) <= now() or p.starts_at <= now() then raise exception 'post is closed or expired'; end if;
  if (select count(*) from join_requests where post_id=p.id and status='approved') >= p.vacancies then raise exception 'post is full'; end if;
  select * into r from join_requests where post_id=p.id and requester_id=auth.uid() for update;
  if found and r.status in ('pending','approved') then raise exception 'you already requested or joined this post'; end if;
  if found and r.decline_count >= 2 then raise exception 'no more requests allowed for this post'; end if;
  if r.id is null then
    insert into join_requests(post_id,requester_id,status,note)
      values(p.id,auth.uid(),'pending',v_note) returning * into r;
  else
    -- Re-request after a decline/withdrawal: fresh row (new id) so the host
    -- is notified again, carrying the decline count forward.
    delete from join_requests where id=r.id;
    insert into join_requests(post_id,requester_id,status,decline_count,note)
      values(p.id,auth.uid(),'pending',r.decline_count,v_note) returning * into r;
  end if;
  if p.auto_accept then
    update join_requests set status='approved' where id=r.id returning * into r;
  end if;
  return to_jsonb(r);
end;
$$ language plpgsql security definer set search_path=public,pg_temp;

create or replace function notify_join_request() returns trigger as $$
declare v_kind text; v_user uuid; v_title text; v_body text; v_auto boolean;
begin
  select p.auto_accept into v_auto from posts p where p.id = new.post_id;
  if tg_op = 'INSERT' then
    -- Auto-accept plans tell the host once the person has joined instead.
    if coalesce(v_auto, false) then return new; end if;
    v_kind := 'join_request';
    select p.author_id into v_user from posts p where p.id = new.post_id;
    select 'New join request',
           pr.display_name || ' wants to join "' || p.title || '"'
      into v_title, v_body
    from profiles pr, posts p
    where pr.id = new.requester_id and p.id = new.post_id;
  elsif tg_op = 'UPDATE' and new.status = 'approved' and old.status is distinct from 'approved' then
    v_kind := 'request_approved';
    v_user := new.requester_id;
    select 'Request approved', 'You''re in! "' || p.title || '"'
      into v_title, v_body from posts p where p.id = new.post_id;
    if coalesce(v_auto, false) then
      insert into notifications (user_id, kind, title, body, ref_id)
      select p.author_id, 'join_request', 'New player joined',
             pr.display_name || ' joined "' || p.title || '"', new.post_id
      from posts p, profiles pr where p.id = new.post_id and pr.id = new.requester_id;
    end if;
  elsif tg_op = 'UPDATE' and new.status = 'declined' and old.status is distinct from 'declined' then
    v_kind := 'request_declined';
    v_user := new.requester_id;
    select 'Request declined', '"' || p.title || '" didn''t work out this time'
      into v_title, v_body from posts p where p.id = new.post_id;
  elsif tg_op = 'UPDATE' and new.status = 'full' and old.status is distinct from 'full' then
    v_kind := 'request_full';
    v_user := new.requester_id;
    select 'Slot full', '"' || p.title || '" filled up before your request was handled'
      into v_title, v_body from posts p where p.id = new.post_id;
  else
    return new;
  end if;

  insert into notifications (user_id, kind, title, body, ref_id)
  values (v_user, v_kind, v_title, v_body, new.post_id);
  return new;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;

notify pgrst, 'reload schema';
