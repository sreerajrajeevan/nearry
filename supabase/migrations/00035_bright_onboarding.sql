-- Additive, owner-only setup preferences. No birthday, verification or role changes.
begin;
create function valid_onboarding_preferences(p jsonb) returns boolean as $$
declare v jsonb; item jsonb;
begin
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>4096
   or p-array['days','times','radiusKm','area'] <> '{}'::jsonb then return false; end if;
 if p ? 'radiusKm' and (jsonb_typeof(p->'radiusKm')<>'number' or p->>'radiusKm' not in ('2','5','10','25')) then return false; end if;
 if p ? 'days' then
   if jsonb_typeof(p->'days')<>'array' or jsonb_array_length(p->'days')>7 then return false; end if;
   for item in select * from jsonb_array_elements(p->'days') loop
     if jsonb_typeof(item)<>'string' or item#>>'{}' not in ('Mon','Tue','Wed','Thu','Fri','Sat','Sun') then return false; end if;
   end loop;
 end if;
 if p ? 'times' then
   if jsonb_typeof(p->'times')<>'array' or jsonb_array_length(p->'times')>4 then return false; end if;
   for item in select * from jsonb_array_elements(p->'times') loop
     if jsonb_typeof(item)<>'string' or item#>>'{}' not in ('Morning','Afternoon','Evening','Night') then return false; end if;
   end loop;
 end if;
 if p ? 'area' then
   v:=p->'area';
   if jsonb_typeof(v)<>'object' or v-array['label','latitude','longitude','source','acquiredAt']<>'{}'::jsonb
    or not (v ?& array['label','latitude','longitude','source','acquiredAt']) then return false; end if;
   if jsonb_typeof(v->'label')<>'string' or char_length(btrim(v->>'label')) not between 1 and 200
    or jsonb_typeof(v->'latitude')<>'number' or jsonb_typeof(v->'longitude')<>'number'
    or jsonb_typeof(v->'source')<>'string' or char_length(v->>'source') not between 1 and 40
    or jsonb_typeof(v->'acquiredAt')<>'string' or char_length(v->>'acquiredAt') not between 1 and 40 then return false; end if;
   if abs((v->>'latitude')::numeric)>90 or abs((v->>'longitude')::numeric)>180 then return false; end if;
 end if;
 return true;
end;
$$ language plpgsql immutable set search_path=public;
revoke all on function valid_onboarding_preferences(jsonb) from public,anon;
grant execute on function valid_onboarding_preferences(jsonb) to authenticated,service_role;

alter table profiles add column onboarding_preferences jsonb not null default '{}'::jsonb
 check(valid_onboarding_preferences(onboarding_preferences));
-- Existing public column grants do not include this column. Owners read through get_my_profile().
revoke select(onboarding_preferences) on profiles from anon,authenticated;
grant update(onboarding_preferences) on profiles to authenticated;

create function finish_personal_onboarding(p_display_name text,p_gender text,p_age integer,
 p_interests text[],p_preferences jsonb,p_terms_accepted boolean default false) returns void as $$
begin
 if not valid_onboarding_preferences(p_preferences) then raise exception 'Invalid setup preferences'; end if;
 if p_interests is null or cardinality(p_interests)>30
   or exists(select 1 from unnest(p_interests) x where x is null or char_length(x) not between 1 and 60) then raise exception 'Invalid interests'; end if;
 -- Reuse the existing server checks for adult age, name, gender, account type,
 -- role selection, active status and explicit current terms. All writes roll back together.
 perform complete_personal_profile(p_display_name,p_gender,p_age,p_terms_accepted);
 update profiles set interests=p_interests,onboarding_preferences=p_preferences where id=auth.uid();
end;
$$ language plpgsql security definer set search_path=public;
revoke all on function finish_personal_onboarding(text,text,integer,text[],jsonb,boolean) from public,anon;
 grant execute on function finish_personal_onboarding(text,text,integer,text[],jsonb,boolean) to authenticated;

-- Reuse the existing retention worker; malformed/future timestamps expire safely too.
create function onboarding_location_expired(p text) returns boolean as $$
declare cached timestamptz;
begin
 if p is null then return true; end if;
 begin cached:=p::timestamptz; exception when others then return true; end;
 return cached<=now()-interval '29 days' or cached>now()+interval '5 minutes';
end;
$$ language plpgsql stable set search_path=public;
revoke all on function onboarding_location_expired(text) from public,anon,authenticated;
grant execute on function onboarding_location_expired(text) to service_role;
alter function maintenance_retention_cleanup() rename to maintenance_retention_before_onboarding;
revoke all on function maintenance_retention_before_onboarding() from public,anon,authenticated;
create function maintenance_retention_cleanup() returns void as $$
begin
 perform maintenance_retention_before_onboarding();
 update profiles set onboarding_preferences=onboarding_preferences-'area'
  where onboarding_preferences ? 'area' and onboarding_location_expired(onboarding_preferences#>>'{area,acquiredAt}');
 update profiles set business_details=business_details-array['latitude','longitude','locationCachedAt']
  where business_details->>'locationSource'='google'
    and (business_details ? 'latitude' or business_details ? 'longitude')
    and onboarding_location_expired(business_details->>'locationCachedAt');
end;
$$ language plpgsql security definer set search_path=public;
revoke all on function maintenance_retention_cleanup() from public,anon,authenticated;
grant execute on function maintenance_retention_cleanup() to service_role;
commit;
