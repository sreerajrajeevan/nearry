-- Server-only counters; no query text or coordinates are persisted.
begin;
create table place_search_usage (
 scope text not null,
 subject text not null,
 window_start timestamptz not null,
 requests int not null default 0,
 primary key(scope,subject,window_start)
);
create index place_search_usage_cleanup on place_search_usage(window_start);
alter table place_search_usage enable row level security;
revoke all on place_search_usage from public,anon,authenticated;
grant all on place_search_usage to service_role;
create function reserve_place_search(p_user_id uuid) returns boolean as $$
declare t timestamptz:=clock_timestamp();u text:=p_user_id::text;limits int[]:=array[2800,4,150,20];
 scopes text[]:=array['global_day','global_second','user_day','user_minute'];
 subjects text[]:=array['all','all',u,u];
 windows timestamptz[]:=array[date_trunc('day',t at time zone 'UTC') at time zone 'UTC',date_trunc('second',t),date_trunc('day',t at time zone 'UTC') at time zone 'UTC',date_trunc('minute',t)];
 i int;
begin
 if p_user_id is null or not exists(select 1 from profiles where id=p_user_id) then raise exception 'valid user required';end if;
 -- Tiny serialized transaction gives a hard shared ceiling across edge instances.
 perform pg_advisory_xact_lock(724193801);
 delete from place_search_usage where window_start<t-interval '2 days';
 for i in 1..4 loop
  if coalesce((select requests from place_search_usage where scope=scopes[i] and subject=subjects[i] and window_start=windows[i]),0)>=limits[i] then return false;end if;
 end loop;
 for i in 1..4 loop
  insert into place_search_usage(scope,subject,window_start,requests) values(scopes[i],subjects[i],windows[i],1)
   on conflict(scope,subject,window_start) do update set requests=place_search_usage.requests+1;
 end loop;
 return true;
end;
$$ language plpgsql security definer set search_path=public;
revoke all on function reserve_place_search(uuid) from public,anon,authenticated;
grant execute on function reserve_place_search(uuid) to service_role;
commit;
