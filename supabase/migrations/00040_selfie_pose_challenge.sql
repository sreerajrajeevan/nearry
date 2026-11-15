-- 00040: a random pose for each selfie check, issued by the server.
-- The person copies the pose in a front-camera selfie within ten minutes, so a
-- reviewer can tell the photo was taken just now and not reused. Each pose is
-- used once. No face templates or biometric processing are added.
begin;

-- The poses, with the wording shown in the app and to reviewers.
create function public.selfie_poses() returns table(id text, label text) as $$
 values
  ('thumbs_up','Thumbs up next to your face'),
  ('peace','Peace sign next to your face'),
  ('ok','OK sign next to your face'),
  ('point_up','Point one finger up beside your face'),
  ('open_palm','Open palm beside your face'),
  ('call_me','Call-me sign (thumb and little finger) by your ear'),
  ('thinking','Hand on your chin, like you are thinking'),
  ('wave','Wave at the camera');
$$ language sql immutable set search_path=public,pg_temp;
grant execute on function public.selfie_poses() to authenticated, service_role;

create table public.personal_selfie_challenges (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 challenge_id uuid not null unique default gen_random_uuid(),
 pose text not null,
 issued_at timestamptz not null default now(),
 expires_at timestamptz not null
);
alter table public.personal_selfie_challenges enable row level security;
revoke all on public.personal_selfie_challenges from public,anon,authenticated;
grant all on public.personal_selfie_challenges to service_role;

-- The pose asked for, kept with the submission for the reviewer.
alter table public.personal_selfie_reviews add column pose text;

create function public.start_selfie_challenge() returns jsonb as $$
declare p profiles; r personal_selfie_reviews; previous text; chosen record; c personal_selfie_challenges;
begin
 if auth.uid() is null or not personal_profile_ready(auth.uid()) then
  raise exception 'Complete your profile first';end if;
 select * into p from profiles where id=auth.uid() for update;
 select * into r from personal_selfie_reviews where user_id=p.id;
 if r.status in ('pending','verified') then raise exception 'Your selfie is already pending or checked';end if;
 select pose into previous from personal_selfie_challenges where user_id=p.id;
 -- A fresh random pose, never the same one twice in a row.
 select * into chosen from selfie_poses() s where s.id is distinct from previous order by random() limit 1;
 insert into personal_selfie_challenges(user_id,challenge_id,pose,issued_at,expires_at)
  values(p.id,gen_random_uuid(),chosen.id,now(),now()+interval '10 minutes')
 on conflict(user_id) do update set challenge_id=excluded.challenge_id,pose=excluded.pose,
  issued_at=excluded.issued_at,expires_at=excluded.expires_at
 returning * into c;
 return jsonb_build_object('challengeId',c.challenge_id,'pose',c.pose,'label',chosen.label,'expiresAt',c.expires_at);
end;
$$ language plpgsql volatile security definer set search_path=public,pg_temp;
revoke all on function public.start_selfie_challenge() from public,anon;
grant execute on function public.start_selfie_challenge() to authenticated;

-- New builds submit against their pose. The existing two-argument version stays
-- for older builds; those submissions carry no pose.
create function public.submit_personal_selfie(p_path text,p_consent boolean,p_challenge uuid) returns void as $$
declare c personal_selfie_challenges;
begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 select * into c from personal_selfie_challenges where user_id=auth.uid() for update;
 if not found or c.challenge_id is distinct from p_challenge then
  raise exception 'This pose is no longer valid. Get a new pose and try again';end if;
 if c.expires_at<=now() then
  raise exception 'Your pose expired. Get a new pose and try again';end if;
 perform submit_personal_selfie(p_path,p_consent);
 update personal_selfie_reviews set pose=c.pose where user_id=auth.uid();
 delete from personal_selfie_challenges where user_id=auth.uid();
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.submit_personal_selfie(text,boolean,uuid) from public,anon;
grant execute on function public.submit_personal_selfie(text,boolean,uuid) to authenticated;

-- A two-argument submission (older build) must not inherit an earlier pose.
create or replace function public.clear_selfie_pose_on_resubmit() returns trigger as $$
begin
 if new.submission_id is distinct from old.submission_id then new.pose:=null;end if;
 return new;
end;
$$ language plpgsql set search_path=public,pg_temp;
create trigger clear_selfie_pose_on_resubmit before update on personal_selfie_reviews
 for each row execute function public.clear_selfie_pose_on_resubmit();

-- The reviewer queue also returns the pose that was asked for (null: older build).
drop function public.admin_console_selfie_queue(int,int);
create function public.admin_console_selfie_queue(p_offset int default 0,p_limit int default 26)
returns table(id uuid,user_id uuid,display_name text,submitted_at timestamptz,pose_label text)
language sql stable security definer set search_path=public,pg_temp as $$
 select r.submission_id,r.user_id,p.display_name,r.submitted_at,s.label
 from personal_selfie_reviews r join profiles p on p.id=r.user_id
 left join selfie_poses() s on s.id=r.pose
 where r.status='pending' and r.submitted_at>now()-interval '7 days' and r.avatar_url_at_submission=p.avatar_url and account_active(p.id)
 order by r.submitted_at,r.user_id limit least(greatest(p_limit,1),100) offset least(greatest(p_offset,0),5000);
$$;
revoke all on function public.admin_console_selfie_queue(int,int) from public,anon,authenticated;
grant execute on function public.admin_console_selfie_queue(int,int) to service_role;

-- Old challenges are cleaned up by the existing retention job (wrapped, as
-- earlier migrations do, so every previous cleanup step still runs).
alter function public.maintenance_retention_cleanup() rename to maintenance_retention_before_selfie_poses;
revoke all on function public.maintenance_retention_before_selfie_poses() from public,anon,authenticated,service_role;
create function public.maintenance_retention_cleanup() returns void as $$
begin
 perform public.maintenance_retention_before_selfie_poses();
 delete from public.personal_selfie_challenges where expires_at<now()-interval '1 day';
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.maintenance_retention_cleanup() from public,anon,authenticated;
grant execute on function public.maintenance_retention_cleanup() to service_role;
notify pgrst,'reload schema';
commit;
