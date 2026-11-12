-- 00034 — Cancel only deletion jobs that have never started.
-- Forward-only follow-up for projects where 00033 is already applied.
-- This replaces a function; it does not cancel or change any account request.
begin;

create or replace function public.admin_console_decide(p_actor uuid,p_kind text,p_record_id uuid,p_decision text,p_note text default '') returns void as $$
declare v_role text; p profiles; j account_deletion_jobs;
begin
 if p_kind is distinct from 'account' then perform admin_console_decide_before_account(p_actor,p_kind,p_record_id,p_decision,p_note); return; end if;
 select role into v_role from public.admin_console_members
  where user_id=p_actor and revoked_at is null and public.account_active(p_actor)
  for update;
 if v_role is null then raise exception 'admin not authorized'; end if;
 if v_role<>'owner' then raise exception 'only owner may manage accounts'; end if;
 if p_record_id is null or p_decision is null or char_length(coalesce(p_note,''))>200 then
  raise exception 'invalid review input';
 end if;
 if p_decision not in ('suspend','unsuspend','cancel-deletion') then
  raise exception 'invalid account action';
 end if;
 if nullif(btrim(coalesce(p_note,'')),'') is null then
  raise exception 'review reason required';
 end if;
 select * into p from profiles where id=p_record_id for update;
 if not found then raise exception 'Account unavailable'; end if;
 if p_decision='suspend' then
  if p.suspended_at is not null then raise exception 'Account already suspended'; end if;
  if exists(select 1 from public.admin_console_members where user_id=p.id and revoked_at is null) then
   raise exception 'Cannot suspend an administrator';
  end if;
  perform public.cancel_account_commitments(p.id);
  update profiles set suspended_at=now() where id=p.id;
 elsif p_decision='unsuspend' then
  if p.suspended_at is null then raise exception 'Account is not suspended'; end if;
  update profiles set suspended_at=null where id=p.id;
 elsif p_decision='cancel-deletion' then
  if p.deletion_requested_at is null then raise exception 'No deletion pending'; end if;
  -- Claiming a job starts file removal, before prepared_at is set. Lock the
  -- same row as claim_account_deletions so cancellation cannot race cleanup.
  select * into j from public.account_deletion_jobs where user_id=p.id for update;
  if not found then raise exception 'Deletion request unavailable'; end if;
  if j.prepared_at is not null or j.lease_id is not null or j.attempts>0 then
   raise exception 'Deletion already in progress';
  end if;
  delete from public.account_deletion_jobs where user_id=p.id;
  update profiles set deletion_requested_at=null where id=p.id;
 end if;
 insert into public.admin_console_audit(actor_id,action,target_id,note)
 values(p_actor,'account:'||p_decision,p_record_id,btrim(coalesce(p_note,'')));
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.admin_console_decide(uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_console_decide(uuid,text,uuid,text,text) to service_role;
commit;
