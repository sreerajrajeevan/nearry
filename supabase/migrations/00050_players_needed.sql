-- Players needed: notification switches, a kept alert area, urgent plans that
-- alert nearby people, and auto-accept.
--
-- Additive: new columns default to "off"/"all on", RPC results only gain keys,
-- so older app builds keep working. Requires 00049.

-- ── Part 1: notification switches and the alert area ─────────────────────

create function valid_notification_settings(v jsonb) returns boolean
language sql immutable set search_path = public as $$
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
language sql immutable set search_path = public as $$
  select case
    when p_kind in ('message','plan_group_message') then 'messages'
    when p_kind in ('join_request','request_approved','request_declined','request_full','post_cancelled') then 'plans'
    when p_kind in ('booking','booking_confirmed','booking_cancelled') then 'bookings'
    when p_kind = 'nearby_plan' then 'nearby'
  end
$$;

create function notification_category_enabled(p_user uuid, p_kind text) returns boolean
language sql stable security definer set search_path = public as $$
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
$$ language plpgsql security definer set search_path=public;

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
$$ language sql stable security definer set search_path=public;

create function set_notification_category(p_category text, p_enabled boolean) returns void as $$
begin
 if p_category is null or p_category not in ('messages','plans','bookings','nearby') or p_enabled is null then
  raise exception 'unknown notification category';
 end if;
 if not account_active(auth.uid()) then raise exception 'account unavailable'; end if;
 update profiles set notification_settings = notification_settings || jsonb_build_object(p_category, p_enabled)
  where id = auth.uid();
end;
$$ language plpgsql security definer set search_path=public;
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
$$ language plpgsql security definer set search_path=public;
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
$$ language plpgsql set search_path=public;
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
$$ language plpgsql security definer set search_path=public;

alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check check (kind in (
  'join_request','request_approved','request_declined','request_full','post_cancelled',
  'booking','booking_confirmed','booking_cancelled','message','verification_approved',
  'verification_rejected','selfie_review','plan_group_message','nearby_plan'));

notify pgrst, 'reload schema';
