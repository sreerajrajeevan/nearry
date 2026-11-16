-- A warmer selfie-approval notification. Only the wording of the notice changes;
-- the review rules, locks and cleanup are the same as 00030.
begin;

create or replace function public.review_personal_selfie(p_user uuid,p_submission uuid,p_decision text,p_note text default '') returns void as $$
declare p profiles; r personal_selfie_reviews;
begin
 if p_decision is null or p_decision not in ('verified','rejected') or char_length(coalesce(p_note,''))>200 then raise exception 'Invalid selfie decision';end if;
 if p_decision='rejected' and nullif(btrim(p_note),'') is null then raise exception 'Review reason required';end if;
 -- All avatar/submit/review paths lock profile first, then review.
 select * into p from profiles where id=p_user for update;
 select * into r from personal_selfie_reviews where user_id=p_user for update;
 if r.status is distinct from 'pending' or r.submission_id is distinct from p_submission
  or r.selfie_path is null or r.submitted_at<=now()-interval '7 days'
  or p.avatar_url is distinct from r.avatar_url_at_submission then raise exception 'Review unavailable, expired or changed; refresh the queue';end if;
 if not account_active(p_user) or p.account_type<>'personal' then raise exception 'Review unavailable for an inactive account';end if;
 if p_decision='verified' and (not exists(select 1 from storage.objects where bucket_id='selfie_proofs' and name=r.selfie_path)
  or not exists(select 1 from storage.objects where bucket_id='avatars' and name=r.avatar_path)) then raise exception 'Review unavailable: comparison photo is missing';end if;
 update personal_selfie_reviews set selfie_path=null,status=p_decision,note=case when p_decision='rejected' then btrim(p_note) else null end,reviewed_at=now() where user_id=p_user;
 insert into media_cleanup_jobs(bucket,path)values('selfie_proofs',r.selfie_path) on conflict(path) do nothing;
 insert into notifications(user_id,kind,title,body)values(p_user,'selfie_review',
  case when p_decision='verified' then 'Congrats, you''re verified! ✅' else 'Your selfie needs another try' end,
  case when p_decision='verified' then 'Your selfie matched your profile photo. Tap to see your green tick.' else btrim(p_note) end);
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.review_personal_selfie(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.review_personal_selfie(uuid,uuid,text,text) to service_role;

-- Reword earlier approvals in the in-app list. Updates do not send another push.
update notifications
set title='Congrats, you''re verified! ✅',
    body='Your selfie matched your profile photo. Tap to see your green tick.'
where kind='selfie_review' and title='Your selfie check is complete';

commit;
