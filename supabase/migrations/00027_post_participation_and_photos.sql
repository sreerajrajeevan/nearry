-- Complete profiles only at participation, with private self-declared age.
-- No ages or genders are inferred/backfilled from Google metadata.
begin;
alter table profiles add column age integer check(age between 18 and 100);
grant update(age) on profiles to authenticated;
-- Public column grants deliberately exclude age; get_my_profile returns it only to its owner.
create function personal_profile_ready(p_user uuid) returns boolean as $$
 select exists(select 1 from profiles p where p.id=p_user and p.account_type='personal'
   and char_length(btrim(p.display_name)) between 2 and 40 and p.onboarding_completed and p.role_selected and p.gender in ('male','female','other')
   and p.age between 18 and 100 and p.terms_version='2026-10-19' and account_active(p.id));
$$ language sql stable security definer set search_path=public;
revoke all on function personal_profile_ready(uuid) from public,anon,authenticated;
grant execute on function personal_profile_ready(uuid) to service_role;
create function my_personal_profile_ready() returns boolean as $$ select personal_profile_ready(auth.uid()); $$ language sql stable security definer set search_path=public;
revoke all on function my_personal_profile_ready() from public,anon;
grant execute on function my_personal_profile_ready() to authenticated;
create function complete_personal_profile(p_display_name text,p_gender text,p_age integer,p_terms_accepted boolean default false) returns void as $$
declare p profiles;
begin
 select * into p from profiles where id=auth.uid() for update;
 if not found or p.account_type<>'personal' or not p.role_selected or not account_active(auth.uid()) then raise exception 'Personal account required';end if;
 if p_display_name is null or char_length(btrim(p_display_name)) not between 2 and 40 or p_gender is null or p_gender not in ('male','female','other')
   or p_age is null or p_age not between 18 and 100 then raise exception 'Enter your name, gender and an age between 18 and 100';end if;
 if p.terms_version is distinct from '2026-10-19' and p_terms_accepted is distinct from true then raise exception 'Please accept the current Terms and Community Guidelines';end if;
 update profiles set display_name=btrim(p_display_name),gender=p_gender,age=p_age,onboarding_completed=true,
   terms_version='2026-10-19',terms_accepted_at=case when p.terms_version is distinct from '2026-10-19' then clock_timestamp() else coalesce(p.terms_accepted_at,clock_timestamp()) end where id=p.id;
end;
$$ language plpgsql security definer set search_path=public;
revoke all on function complete_personal_profile(text,text,integer,boolean) from public,anon;
grant execute on function complete_personal_profile(text,text,integer,boolean) to authenticated;
create policy "complete personal profile before posting" on posts as restrictive for insert with check(my_personal_profile_ready());

-- Runs through request/approval RPCs as well as any allowed direct write.
create function enforce_join_eligibility() returns trigger as $$
declare audience text; eligible boolean;
begin
 if new.status not in ('pending','approved') then return new;end if;
 if tg_op='UPDATE' and row(new.status,new.requester_id,new.post_id) is not distinct from row(old.status,old.requester_id,old.post_id) then return new;end if;
 select gender_preference into audience from posts where id=new.post_id;
 select personal_profile_ready(new.requester_id) and (audience is null or audience='any' or p.gender=audience)
 into eligible from profiles p where p.id=new.requester_id;
 -- Reopening a full post must not prevent a different participant from leaving.
 if tg_op='UPDATE' and old.status='full' and new.status='pending' and not coalesce(eligible,false) then new.status:='declined';return new;end if;
 if not personal_profile_ready(new.requester_id) then raise exception 'Complete your profile with name, gender and age before joining a plan';end if;
 if not coalesce(eligible,false) then raise exception 'This plan is for % only',case when audience='female' then 'females' else 'males' end;end if;
 return new;
end;
$$ language plpgsql security definer set search_path=public;
revoke all on function enforce_join_eligibility() from public,anon,authenticated;
create trigger join_eligibility before insert or update on join_requests for each row execute function enforce_join_eligibility();

-- Audience changes cannot silently exclude already-approved participants.
create function guard_post_audience() returns trigger as $$
begin
 if new.gender_preference is not distinct from old.gender_preference then return new;end if;
 if new.gender_preference in ('female','male') and exists(
  select 1 from join_requests r join profiles p on p.id=r.requester_id where r.post_id=new.id and r.status='approved' and p.gender is distinct from new.gender_preference
 ) then raise exception 'Approved participants do not match this audience. Keep Anyone, or choose an audience that includes them.';end if;
 return new;
end;
$$ language plpgsql security definer set search_path=public;
revoke all on function guard_post_audience() from public,anon,authenticated;
create trigger guard_post_audience before update of gender_preference on posts for each row execute function guard_post_audience();
create function reconcile_post_audience() returns trigger as $$
begin
 if new.gender_preference in ('female','male') and new.gender_preference is distinct from old.gender_preference then
  update join_requests r set status='declined' where r.post_id=new.id and r.status in ('pending','full')
    and not exists(select 1 from profiles p where p.id=r.requester_id and p.gender=new.gender_preference);
 end if;
 return new;
end;
$$ language plpgsql security definer set search_path=public;
revoke all on function reconcile_post_audience() from public,anon,authenticated;
create trigger reconcile_post_audience after update of gender_preference on posts for each row execute function reconcile_post_audience();

-- Atomic photo selection: existing attachments survive failed uploads/requests.
create function set_post_photos(p_post_id uuid,p_urls text[]) returns void as $$
declare owner uuid; url text; object_path text; position integer:=0;
begin
 select author_id into owner from posts where id=p_post_id for update;
 if owner is distinct from auth.uid() or not account_active(auth.uid()) then raise exception 'Only the active host can edit photos';end if;
 if p_urls is null or cardinality(p_urls)>5 or cardinality(p_urls)<>(select count(distinct x) from unnest(p_urls) x) then raise exception 'Choose up to 5 different photos';end if;
 foreach url in array p_urls loop
  if not exists(select 1 from post_photos f where f.post_id=p_post_id and f.photo_url=url) then
   object_path:=split_part(url,'/storage/v1/object/public/photos/',2);
   if url is null or url !~ '^https://' or object_path='' or split_part(object_path,'/',1)<>auth.uid()::text
     or not exists(select 1 from storage.objects where bucket_id='photos' and name=object_path) then raise exception 'Upload your own photo before attaching it';end if;
  end if;
 end loop;
 delete from post_photos a using post_photos b where a.post_id=p_post_id and b.post_id=a.post_id and a.photo_url=b.photo_url and a.id>b.id;
 delete from post_photos f where f.post_id=p_post_id and not (f.photo_url=any(p_urls));
 foreach url in array p_urls loop
  update post_photos set sort_order=position where post_id=p_post_id and photo_url=url;
  if not found then insert into post_photos(post_id,photo_url,sort_order)values(p_post_id,url,position);end if;
  position:=position+1;
 end loop;
end;
$$ language plpgsql security definer set search_path=public;
revoke all on function set_post_photos(uuid,text[]) from public,anon;
grant execute on function set_post_photos(uuid,text[]) to authenticated;
commit;
