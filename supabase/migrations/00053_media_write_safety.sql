-- Direct writes use the same ownership, count and media lifecycle rules as the app.
begin;
create function public.guard_public_photo_attachment() returns trigger as $$
declare owner uuid; amount int; max_photos int; object_path text; issuer text; origin text; job media_cleanup_jobs;
begin
 if current_setting('role',true)<>'authenticated' then return new;end if;
 if tg_table_name='post_photos' then
  select author_id into owner from posts where id=new.post_id for update;
  max_photos=5;
 else
  select business_id into owner from venues where id=new.venue_id for update;
  max_photos=20;
 end if;
 if owner is distinct from auth.uid() or not account_active(auth.uid()) then raise exception 'Only the active owner can attach photos';end if;
 -- Unchanged legacy URLs may be reordered; moving them to another parent is a new attachment.
 if tg_op='UPDATE' and new.photo_url=old.photo_url and
   ((tg_table_name='post_photos' and to_jsonb(new)->>'post_id'=to_jsonb(old)->>'post_id') or
    (tg_table_name='venue_photos' and to_jsonb(new)->>'venue_id'=to_jsonb(old)->>'venue_id')) then return new;end if;
 issuer=nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'iss';
 origin=substring(issuer from '^(https://[^/]+)/auth/v1$');
 object_path=split_part(new.photo_url,'/storage/v1/object/public/photos/',2);
 if origin is null or new.photo_url<>origin||'/storage/v1/object/public/photos/'||object_path
   or object_path !~ '^[a-f0-9-]{36}/[a-zA-Z0-9-]+/[a-zA-Z0-9._-]+$'
   or split_part(object_path,'/',1)<>auth.uid()::text
   or not exists(select 1 from storage.objects where bucket_id='photos' and name=object_path)
 then raise exception 'Upload your own photo before attaching it';end if;
 if tg_table_name='post_photos' then
  select count(*) into amount from post_photos where post_id=new.post_id and id<>new.id;
  if exists(select 1 from post_photos where post_id=new.post_id and photo_url=new.photo_url and id<>new.id) then raise exception 'Choose different photos';end if;
 else
  select count(*) into amount from venue_photos where venue_id=new.venue_id and id<>new.id;
  if exists(select 1 from venue_photos where venue_id=new.venue_id and photo_url=new.photo_url and id<>new.id) then raise exception 'Choose different photos';end if;
 end if;
 if amount>=max_photos then raise exception 'Too many photos (maximum %)',max_photos;end if;
 select * into job from media_cleanup_jobs where bucket='photos' and path in(object_path,replace(object_path,'-full.jpg','-thumb.jpg')) order by attempts desc limit 1 for update;
 if found and job.attempts>0 then raise exception 'This old photo is being removed. Upload it again.';end if;
 delete from media_cleanup_jobs where bucket='photos' and path in(object_path,replace(object_path,'-full.jpg','-thumb.jpg')) and attempts=0;
 return new;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.guard_public_photo_attachment() from public,anon,authenticated;
create trigger guard_public_photo_attachment before insert or update on public.post_photos for each row execute function public.guard_public_photo_attachment();
create trigger guard_public_photo_attachment before insert or update on public.venue_photos for each row execute function public.guard_public_photo_attachment();

create function public.public_photo_referenced(p_path text) returns boolean as $$
 select exists(select 1 from post_photos where split_part(photo_url,'/storage/v1/object/public/photos/',2)=p_path)
 or exists(select 1 from venue_photos where split_part(photo_url,'/storage/v1/object/public/photos/',2)=p_path)
 or exists(select 1 from offers where split_part(cover_photo_url,'/storage/v1/object/public/photos/',2)=p_path);
$$ language sql stable security definer set search_path=public,pg_temp;
revoke all on function public.public_photo_referenced(text) from public,anon,authenticated;

create function public.queue_removed_public_photo() returns trigger as $$
declare url text; removed_path text;
begin
 url=case when tg_table_name='offers' then to_jsonb(old)->>'cover_photo_url' else to_jsonb(old)->>'photo_url' end;
 if tg_op='UPDATE' and url=(case when tg_table_name='offers' then to_jsonb(new)->>'cover_photo_url' else to_jsonb(new)->>'photo_url' end) then return new;end if;
 removed_path=split_part(url,'/storage/v1/object/public/photos/',2);
 if removed_path ~ '^[a-f0-9-]{36}/[a-zA-Z0-9-]+/[a-zA-Z0-9._-]+$' and not public_photo_referenced(removed_path) then
  insert into media_cleanup_jobs(bucket,path,next_attempt_at) values('photos',removed_path,now()+interval '1 day') on conflict(path) do nothing;
  if removed_path ~ '-full\.jpg$' then insert into media_cleanup_jobs(bucket,path,next_attempt_at) values('photos',regexp_replace(removed_path,'-full\.jpg$','-thumb.jpg'),now()+interval '1 day') on conflict(path) do nothing;end if;
 end if;
 return null;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.queue_removed_public_photo() from public,anon,authenticated;
create trigger queue_removed_public_photo after delete or update of photo_url on public.post_photos for each row execute function public.queue_removed_public_photo();
create trigger queue_removed_public_photo after delete or update of photo_url on public.venue_photos for each row execute function public.queue_removed_public_photo();
create trigger queue_removed_offer_photo after delete or update of cover_photo_url on public.offers for each row execute function public.queue_removed_public_photo();

create or replace function public.claim_media_cleanup() returns setof media_cleanup_jobs as $$
begin
 -- Reattachment (including old-client retries) always wins before a cleanup lease.
 delete from media_cleanup_jobs where bucket='photos' and public_photo_referenced(regexp_replace(path,'-thumb\.jpg$','-full.jpg'));
 return query with due as(select id from media_cleanup_jobs where next_attempt_at<=now() and attempts<20 order by next_attempt_at for update skip locked limit 100)
 update media_cleanup_jobs j set attempts=j.attempts+1,next_attempt_at=now()+interval '10 minutes' from due where j.id=due.id returning j.*;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;

-- Registration from older app versions invalidates any previous logout capability.
create or replace function public.register_push_token(p_token text,p_platform text) returns void as $$
begin
 if not account_active(auth.uid()) then raise exception 'Account unavailable';end if;
 if p_token is null or p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'
 or p_platform is null or p_platform not in ('ios','android') then raise exception 'invalid push token';end if;
 insert into push_tokens(user_id,token,platform,updated_at,revoke_hash) values(auth.uid(),p_token,p_platform,now(),null)
 on conflict(token) do update set user_id=excluded.user_id,platform=excluded.platform,updated_at=now(),revoke_hash=null;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;

-- Historical trigger functions keep their behavior with a pinned lookup path.
do $$ declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prorettype='trigger'::regtype and not exists(select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%')
 loop execute format('alter function %s set search_path=public,pg_temp',f.signature);end loop;
end $$;
notify pgrst,'reload schema';
commit;
