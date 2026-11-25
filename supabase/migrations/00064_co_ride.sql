-- Co-ride plans: a new plan type "ride", with an optional rideMode of
-- 'bike' or 'car' (absent = either), only allowed on a ride. Existing plans
-- stay valid: this only widens what is accepted.
begin;
create or replace function valid_plan_details(v jsonb) returns boolean as $$
 select coalesce(jsonb_typeof(v)='object' and not exists(select 1 from jsonb_object_keys(v) k where k not in ('activity','durationMinutes','level','venueBooked','costMode','ageMin','ageMax','totalCostCents','rideMode'))
 and (not v?'activity' or v->>'activity' in ('gym','football','badminton','cricket','running','cycling','tennis','coffee','food','movies','walk','ride','other'))
 and (not v?'rideMode' or v->>'activity'='ride' and v->>'rideMode' in ('bike','car'))
 and (not v?'durationMinutes' or jsonb_typeof(v->'durationMinutes')='number' and (v->>'durationMinutes')::numeric in (30,60,90,120,180,240))
 and (not v?'level' or v->>'level' in ('any','beginner','intermediate','advanced'))
 and (not v?'venueBooked' or jsonb_typeof(v->'venueBooked')='boolean')
 and (not v?'costMode' or v->>'costMode' in ('free','split','person'))
 and (not v?'ageMin' or jsonb_typeof(v->'ageMin')='number' and (v->>'ageMin')::numeric between 18 and 100 and (v->>'ageMin')::numeric=trunc((v->>'ageMin')::numeric))
 and (not v?'ageMax' or jsonb_typeof(v->'ageMax')='number' and (v->>'ageMax')::numeric between 18 and 100 and (v->>'ageMax')::numeric=trunc((v->>'ageMax')::numeric))
 and coalesce((v->>'ageMin')::numeric,18)<=coalesce((v->>'ageMax')::numeric,100)
 and (not v?'totalCostCents' or jsonb_typeof(v->'totalCostCents')='number' and (v->>'totalCostCents')::numeric between 0 and 100000000 and (v->>'totalCostCents')::numeric=trunc((v->>'totalCostCents')::numeric)),false);
$$ language sql immutable set search_path=public,pg_temp;
commit;
