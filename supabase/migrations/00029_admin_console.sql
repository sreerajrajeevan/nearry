-- 00029: Private, explicitly allowlisted Nearry operations dashboard.
-- Admin web client never receives the service-role key or direct table privileges.
begin;

create table public.admin_console_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check(role in ('owner','moderator')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.admin_console_members enable row level security;
revoke all on public.admin_console_members from public,anon,authenticated;
grant all on public.admin_console_members to service_role;

create table public.admin_console_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 1 and 80),
  target_id uuid,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index admin_console_audit_recent on public.admin_console_audit(created_at desc);
alter table public.admin_console_audit enable row level security;
revoke all on public.admin_console_audit from public,anon,authenticated;
grant all on public.admin_console_audit to service_role;

-- Page the current requests in SQL, before LIMIT/OFFSET. Filtering stale
-- requests after pagination could hide valid submissions on later pages.
create function public.admin_console_business_queue(p_offset int default 0, p_limit int default 26)
returns table(id uuid,user_id uuid,created_at timestamptz,business_name text,
  display_name text,business_details jsonb)
language sql stable security definer set search_path=public,pg_temp as $$
  select j.id,j.user_id,j.created_at,p.business_name,p.display_name,p.business_details
  from verification_review_jobs j join profiles p on p.id=j.user_id
  where j.reviewed_at is null and p.account_type='business'
    and p.verification_status='pending' and p.verification_doc_path=j.document_path
    and public.account_active(p.id)
  order by j.created_at,j.id
  limit least(greatest(p_limit,1),100) offset least(greatest(p_offset,0),5000);
$$;
revoke all on function public.admin_console_business_queue(int,int) from public,anon,authenticated;
grant execute on function public.admin_console_business_queue(int,int) to service_role;

create function public.admin_console_overview() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'users',(select count(*) from profiles),
    'plans',(select count(*) from posts),
    'offers',(select count(*) from offers),
    'bookings',(select count(*) from bookings),
    'openReports',(select count(*) from content_reports where status='open'),
    'pendingBusinessReviews',(select count(*) from verification_review_jobs j join profiles p on p.id=j.user_id
      where j.reviewed_at is null and p.account_type='business' and p.verification_status='pending'
        and p.verification_doc_path=j.document_path and public.account_active(p.id))
  );
$$;
revoke all on function public.admin_console_overview() from public,anon,authenticated;
grant execute on function public.admin_console_overview() to service_role;

-- Only a trusted server holding the service-role key can call this wrapper.
-- It checks the acting human against an allowlist and records decisions in
-- the same transaction as the already-secured, atomic moderation RPCs.
create function public.admin_console_decide(
  p_actor uuid, p_kind text, p_record_id uuid,
  p_decision text, p_note text default ''
) returns void as $$
declare v_role text; j verification_review_jobs; p profiles; note text;
begin
  select role into v_role
  from public.admin_console_members
  where user_id=p_actor and revoked_at is null
    and public.account_active(p_actor)
  for update;

  if v_role is null then raise exception 'admin not authorized'; end if;
  if p_record_id is null or p_kind is null or p_decision is null
     or char_length(coalesce(p_note,'')) > 200 then
    raise exception 'invalid review input';
  end if;
  if p_kind='report' and p_decision='suspend' and v_role<>'owner' then
    raise exception 'only owner may suspend accounts';
  end if;
  if p_decision in ('rejected','remove','suspend')
     and nullif(btrim(coalesce(p_note,'')),'') is null then
    raise exception 'review reason required';
  end if;
  if p_kind='business' then
    if p_decision not in ('approved','rejected') then
      raise exception 'invalid business decision';
    end if;
    -- Admin sessions are independently authenticated with MFA by the Edge API.
    -- The seven-day expiry protects emailed bearer links, not a current proof
    -- reviewed by an authenticated operator. Keep email-link RPCs unchanged.
    select * into j from verification_review_jobs where id=p_record_id;
    if not found then raise exception 'review unavailable'; end if;
    select * into p from profiles where id=j.user_id for update;
    select * into j from verification_review_jobs where id=p_record_id for update;
    if j.reviewed_at is not null or p.account_type<>'business'
       or not public.account_active(p.id) or p.verification_status<>'pending'
       or p.verification_doc_path is distinct from j.document_path then
      raise exception 'review unavailable, stale, or already completed';
    end if;
    note:=case when p_decision='rejected' then btrim(p_note) else null end;
    update profiles set verification_status=case when p_decision='approved' then 'verified' else 'rejected' end,
      verification_note=note where id=p.id;
    update verification_review_jobs set reviewed_at=now(),decision=p_decision where id=j.id;
    insert into notifications(user_id,kind,title,body) values(p.id,
      case when p_decision='approved' then 'verification_approved' else 'verification_rejected' end,
      case when p_decision='approved' then 'Verification approved' else 'Verification needs attention' end,
      case when p_decision='approved' then 'Your business is verified. You can now publish offers.' else note end);
  elsif p_kind='report' then
    if p_decision not in ('dismiss','remove','suspend') then
      raise exception 'invalid report action';
    end if;
    perform public.review_content_report(p_record_id,p_decision,p_note);
  else
    raise exception 'unsupported admin action';
  end if;

  insert into public.admin_console_audit(actor_id,action,target_id,note)
  values(p_actor,p_kind||':'||p_decision,p_record_id,coalesce(p_note,''));
end;
$$ language plpgsql security definer set search_path=public,pg_temp;

revoke all on function public.admin_console_decide(uuid,text,uuid,text,text)
from public,anon,authenticated;
grant execute on function public.admin_console_decide(uuid,text,uuid,text,text)
to service_role;
commit;
