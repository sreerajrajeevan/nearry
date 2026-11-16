-- Review the business and its public location as one immutable submission.
begin;
alter table public.verification_review_jobs add column venue_submission jsonb;
alter table public.venues add column address text;
alter table public.venues add column verified_at timestamptz;
alter table public.venues add column location_lat double precision;
alter table public.venues add column location_lng double precision;

create function public.valid_business_venue(v jsonb) returns boolean
language sql immutable set search_path=public,pg_temp as $$
 select coalesce(jsonb_typeof(v)='object'
   and jsonb_typeof(v->'name')='string' and char_length(btrim(v->>'name')) between 2 and 120
   and jsonb_typeof(v->'category')='string' and char_length(btrim(v->>'category')) between 2 and 60
   and jsonb_typeof(v->'area')='string' and char_length(btrim(v->>'area')) between 2 and 120
   and jsonb_typeof(v->'address')='string' and char_length(btrim(v->>'address')) between 8 and 500
   and jsonb_typeof(v->'latitude')='number' and (v->>'latitude')::double precision between -90 and 90
   and jsonb_typeof(v->'longitude')='number' and (v->>'longitude')::double precision between -180 and 180
   and v->>'source' in ('device','manual'), false);
$$;
-- Old app builds must not send proof-only requests that an admin could mistake
-- for a location review. Keep the signature with an actionable upgrade error.
create or replace function public.submit_verification(p_path text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin raise exception 'Update Nearry and include your business address and location with the verification request.'; end;
$$;
create function public.submit_business_verification(p_path text,p_venue jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare p profiles; v jsonb;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select * into p from profiles where id=auth.uid() for update;
 if not found or p.account_type<>'business' or not public.account_active(p.id)
   or not p.onboarding_completed then raise exception 'Complete your business profile first.'; end if;
 -- A verified legacy business without a venue, or an old proof-only pending
 -- request, may submit the missing location. Existing reviewed venues are locked.
 if p.verification_status='verified' and exists(select 1 from venues where business_id=p.id) then
   raise exception 'Your venue is already linked. Contact support to change its location.';
 end if;
 if p.verification_status='pending' and exists(select 1 from verification_review_jobs
   where user_id=p.id and reviewed_at is null and venue_submission is not null) then
   raise exception 'Your business and location are already under review.';
 end if;
 if not public.valid_business_venue(p_venue) then raise exception 'Enter the venue name, category, area, full address and exact location.'; end if;
 if p_path is null or split_part(p_path,'/',1)<>p.id::text or not exists(
   select 1 from storage.objects where bucket_id='verification_docs' and name=p_path
 ) then raise exception 'Upload your business proof document first.'; end if;
 v:=jsonb_build_object('name',btrim(p_venue->>'name'),'category',btrim(p_venue->>'category'),
   'area',btrim(p_venue->>'area'),'address',btrim(p_venue->>'address'),
   'latitude',(p_venue->>'latitude')::double precision,'longitude',(p_venue->>'longitude')::double precision,
   'source',p_venue->>'source');
 -- Force a fresh review job even when replacing an old pending request and
 -- reusing its document. Both transitions and the snapshot commit atomically.
 update profiles set verification_status='unverified' where id=p.id;
 update profiles set verification_status='pending',verification_doc_path=p_path where id=p.id;
 update verification_review_jobs set venue_submission=v where user_id=p.id and reviewed_at is null;
end;
$$;
revoke all on function public.submit_business_verification(text,jsonb) from public,anon;
grant execute on function public.submit_business_verification(text,jsonb) to authenticated;

create function public.get_my_business_venue() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object(
  'venue',(select jsonb_build_object('id',v.id,'name',v.name,'category',v.category,'area',v.area,'address',v.address)
    from venues v where v.business_id=auth.uid() order by v.verified_at desc nulls last,v.created_at,v.id limit 1),
  'submission',(select j.venue_submission from verification_review_jobs j where j.user_id=auth.uid()
    order by j.created_at desc,j.id desc limit 1))
 where exists(select 1 from profiles where id=auth.uid() and account_type='business' and public.account_active(id));
$$;
revoke all on function public.get_my_business_venue() from public,anon;
grant execute on function public.get_my_business_venue() to authenticated;

-- Retain the existing approval RPCs, their locks, MFA/allowlist gates and audit
-- trail. This trigger makes venue creation part of BOTH admin/email decisions.
create function public.approve_business_venue() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare v jsonb; venue uuid; lat double precision; lng double precision;
begin
 if new.decision is distinct from 'approved' or old.decision='approved' then return new; end if;
 v:=new.venue_submission;
 lat:=(v->>'latitude')::double precision; lng:=(v->>'longitude')::double precision;
 if not public.valid_business_venue(v) then
  raise exception 'This request has no complete venue. Ask the business to resubmit its address and location.';
 end if;
 if not exists(select 1 from profiles where id=new.user_id and account_type='business'
   and verification_status='verified' and public.account_active(id)) then raise exception 'Business not approved.'; end if;
 select id into venue from venues where business_id=new.user_id order by verified_at desc nulls last,created_at,id limit 1 for update;
 if venue is null then
  insert into venues(business_id,name,category,area) values(new.user_id,v->>'name',v->>'category',v->>'area') returning id into venue;
 end if;
 update venues set name=v->>'name',category=v->>'category',area=v->>'area',address=v->>'address',
  location_lat=lat,location_lng=lng,
  location=st_setsrid(st_makepoint(lng,lat),4326)::geography,
  verified_at=now() where id=venue;
 -- Repair old offers only after their owner/location have been reviewed. Keep
 -- existing linked offers, booking slots and booking/chat history intact.
 update offers set venue_id=venue where business_id=new.user_id and venue_id is null;
 return new;
end;
$$;
create trigger trg_approve_business_venue after update of decision on public.verification_review_jobs
 for each row execute function public.approve_business_venue();
revoke all on function public.approve_business_venue() from public,anon,authenticated;

-- Old admin pages and old emailed forms must not approve a complete venue
-- without explicitly confirming the location. Keep old calls usable for rejection
-- and unrelated moderation, but default their location confirmation to false.
alter function public.review_verification(uuid,text,text) rename to review_verification_before_venue;
revoke all on function public.review_verification_before_venue(uuid,text,text) from public,anon,authenticated,service_role;
create function public.review_verification(p_review_id uuid,p_decision text,p_reason text default null,p_location_confirmed boolean default false) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_decision='approved' and not coalesce(p_location_confirmed,false) then raise exception 'Review and confirm the business address and map pin before approval.'; end if;
 perform public.review_verification_before_venue(p_review_id,p_decision,p_reason);
end;
$$;
revoke all on function public.review_verification(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.review_verification(uuid,text,text,boolean) to service_role;
alter function public.admin_console_decide(uuid,text,uuid,text,text) rename to admin_console_decide_before_venue;
revoke all on function public.admin_console_decide_before_venue(uuid,text,uuid,text,text) from public,anon,authenticated,service_role;
create function public.admin_console_decide(p_actor uuid,p_kind text,p_record_id uuid,p_decision text,p_note text default '',p_location_confirmed boolean default false) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_kind='business' and p_decision='approved' and not coalesce(p_location_confirmed,false) then raise exception 'Review and confirm the business address and map pin before approval.'; end if;
 perform public.admin_console_decide_before_venue(p_actor,p_kind,p_record_id,p_decision,p_note);
end;
$$;
revoke all on function public.admin_console_decide(uuid,text,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.admin_console_decide(uuid,text,uuid,text,text,boolean) to service_role;

drop function public.admin_console_business_queue(int,int);
create function public.admin_console_business_queue(p_offset int default 0,p_limit int default 26)
returns table(id uuid,user_id uuid,created_at timestamptz,business_name text,display_name text,business_details jsonb,venue_submission jsonb)
language sql stable security definer set search_path=public,pg_temp as $$
 select j.id,j.user_id,j.created_at,p.business_name,p.display_name,p.business_details,j.venue_submission
 from verification_review_jobs j join profiles p on p.id=j.user_id
 where j.reviewed_at is null and p.account_type='business' and p.verification_status='pending'
 and p.verification_doc_path=j.document_path and public.account_active(p.id)
 order by j.created_at,j.id limit least(greatest(p_limit,1),100) offset least(greatest(p_offset,0),5000);
$$;
revoke all on function public.admin_console_business_queue(int,int) from public,anon,authenticated;
grant execute on function public.admin_console_business_queue(int,int) to service_role;
create or replace function guard_offer_publish() returns trigger as $$
declare p profiles;
begin
 if tg_op='UPDATE' and new.business_id is distinct from old.business_id then raise exception 'offer ownership cannot change'; end if;
 -- Legacy malformed windows must still be cancellable without rewriting history.
 if tg_op='UPDATE' and new.status in ('ended','cancelled') and
  row(new.title,new.description,new.discount_pct,new.price_cents,new.starts_at,new.ends_at,new.slot_capacity,new.slot_minutes,new.resource_key,new.venue_id) is not distinct from
  row(old.title,old.description,old.discount_pct,old.price_cents,old.starts_at,old.ends_at,old.slot_capacity,old.slot_minutes,old.resource_key,old.venue_id) then return new; end if;
 if tg_op='UPDATE' and old.venue_id is null and new.venue_id is not null
   and current_setting('role',true) not in ('authenticated','anon')
   and (to_jsonb(new)-'venue_id') is not distinct from (to_jsonb(old)-'venue_id')
   and exists(select 1 from venues where id=new.venue_id and business_id=new.business_id and verified_at is not null)
 then return new; end if;
 if new.ends_at<=new.starts_at or new.ends_at-new.starts_at<make_interval(mins=>new.slot_minutes)
   or new.slot_capacity not between 1 and 500 or new.ends_at-new.starts_at>interval '31 days'
   or char_length(btrim(new.title)) not between 4 and 80
   or char_length(btrim(new.description)) not between 10 and 1000 then raise exception 'invalid offer details or booking window'; end if;
 select * into p from profiles where id=new.business_id for update;
 if p.account_type is distinct from 'business' or not p.onboarding_completed then raise exception 'business onboarding required'; end if;
 if new.venue_id is null then
   select id into new.venue_id from venues where business_id=new.business_id order by verified_at desc nulls last,created_at,id limit 1;
 end if;
 if new.venue_id is not null and not exists(select 1 from venues where id=new.venue_id and business_id=new.business_id) then
   raise exception 'choose a venue associated with your business';
 end if;
 if new.status='live' and p.verification_status is distinct from 'verified' then raise exception 'only verified businesses can publish'; end if;
 if new.status='live' and new.venue_id is null then raise exception 'Submit your business venue for verification before publishing.'; end if;
 if tg_op='INSERT' and new.starts_at<=now() then raise exception 'offer starts must be in the future'; end if;
 if tg_op='UPDATE' then
   if old.status in ('ended','cancelled') and new.status is distinct from old.status then raise exception 'ended offers cannot reopen'; end if;
   if old.status='live' and new.status='draft' then raise exception 'a live offer must be cancelled rather than returned to draft'; end if;
   if old.status='live' and row(new.starts_at,new.ends_at,new.slot_capacity,new.slot_minutes,new.resource_key,new.venue_id) is distinct from
     row(old.starts_at,old.ends_at,old.slot_capacity,old.slot_minutes,old.resource_key,old.venue_id) and not (old.venue_id is null and new.venue_id is not null
   and current_setting('role',true) not in ('authenticated','anon')
   and row(new.starts_at,new.ends_at,new.slot_capacity,new.slot_minutes,new.resource_key)
    is not distinct from row(old.starts_at,old.ends_at,old.slot_capacity,old.slot_minutes,old.resource_key))
  then raise exception 'live slot details cannot change'; end if;
 end if;
 if new.status='live' and (tg_op='INSERT' or old.status<>'live') then
   if new.ends_at<=now() then raise exception 'offer expired'; end if;
   if exists(select 1 from offers o where o.id<>new.id and o.business_id=new.business_id and o.resource_key=new.resource_key
     and o.status='live' and o.ends_at>now() and o.starts_at<new.ends_at and o.ends_at>new.starts_at) then raise exception 'another live offer overlaps this resource'; end if;
 end if;
 return new;
end;
$$ language plpgsql security definer set search_path=public;
notify pgrst,'reload schema';
commit;
