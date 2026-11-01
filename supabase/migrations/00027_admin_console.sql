-- 00027: Private, explicitly allowlisted Nearry operations dashboard.
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

-- Only a trusted server holding the service-role key can call this wrapper.
-- It checks the acting human against an allowlist and records decisions in
-- the same transaction as the already-secured, atomic moderation RPCs.
create function public.admin_console_decide(
  p_actor uuid, p_kind text, p_record_id uuid,
  p_decision text, p_note text default ''
) returns void as $$
declare v_role text;
begin
  select role into v_role
  from public.admin_console_members
  where user_id=p_actor and revoked_at is null;

  if v_role is null then raise exception 'admin not authorized'; end if;
  if p_record_id is null or char_length(coalesce(p_note,'')) > 200 then
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
    perform public.review_verification(p_record_id,p_decision,p_note);
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
