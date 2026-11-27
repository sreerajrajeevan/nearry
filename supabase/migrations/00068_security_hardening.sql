-- Security hardening from the November audit.
-- 1. Signed-out callers (anon) can read what RLS allows but never write tables.
--    RLS already refused these writes; this removes the grants as well.
-- 2. Nobody but the database owner can TRUNCATE app tables (TRUNCATE skips RLS).
-- 3. Trigger functions stay triggers: they can no longer be called as /rpc/ endpoints.
-- 4. PostGIS keeps spatial_ref_sys in public, owned by supabase_admin, so its
--    grants cannot be changed here. A PostgREST pre-request check refuses writes
--    to it (and the two PostGIS views) through the API.
-- 5. nearby_venues gets a fixed search_path.

do $$
declare r record;
begin
  for r in
    select c.oid::regclass as rel
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'v', 'm', 'p')
      and pg_get_userbyid(c.relowner) = current_user
      and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
  loop
    execute format('revoke insert, update, delete, truncate on %s from anon', r.rel);
    execute format('revoke truncate on %s from authenticated', r.rel);
  end loop;

  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype = 'trigger'::regtype
      and pg_get_userbyid(p.proowner) = current_user
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.fn);
  end loop;

  if to_regprocedure('public.nearby_venues(double precision,double precision,integer)') is not null then
    alter function public.nearby_venues(double precision, double precision, integer)
      set search_path = public, extensions, pg_temp;
  end if;
end $$;

-- New tables and functions follow the same rules.
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon;
alter default privileges in schema public revoke truncate on tables from authenticated;

create or replace function public.guard_api_request()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.method', true), 'GET') not in ('GET', 'HEAD', 'OPTIONS')
     and coalesce(current_setting('request.path', true), '')
         ~* '(^|/)(spatial_ref_sys|geometry_columns|geography_columns)/?$'
  then
    raise exception using errcode = '42501', message = 'This table is read-only';
  end if;
end;
$$;

grant execute on function public.guard_api_request() to anon, authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    alter role authenticator set pgrst.db_pre_request = 'public.guard_api_request';
    notify pgrst, 'reload config';
  end if;
end $$;
