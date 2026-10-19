begin;
create table push_deliveries (
 id uuid primary key default gen_random_uuid(),job_id uuid not null references push_jobs(id) on delete cascade,
 token text not null,registered_at timestamptz not null,ticket_id text unique,
 status text not null check(status in ('ticket','delivered','dead','failed')),
 created_at timestamptz not null default now(),next_check_at timestamptz not null default now()+interval '15 minutes',
 receipt_attempts int not null default 0,last_error text,checked_at timestamptz,
 unique(job_id,token)
);
alter table push_deliveries enable row level security;
revoke all on push_deliveries from public,anon,authenticated;
grant all on push_deliveries to service_role;
create index push_receipts_due on push_deliveries(next_check_at) where status='ticket';
create or replace function claim_push_receipts() returns setof push_deliveries as $$
 with due as(select id from push_deliveries where status='ticket' and next_check_at<=now() order by next_check_at for update skip locked limit 100)
 update push_deliveries d set next_check_at=now()+interval '10 minutes',receipt_attempts=d.receipt_attempts+1 from due where d.id=due.id returning d.*;
$$ language sql security definer set search_path=public;
create or replace function claim_push_jobs() returns jsonb as $$
 with jobs as(select j.id from push_jobs j join notifications n on n.id=j.notification_id join profiles p on p.id=n.user_id
 where j.sent_at is null and j.attempts<5 and j.next_attempt_at<=now() and p.push_enabled
 and notification_allowed(n.user_id,n.kind,n.ref_id) order by j.next_attempt_at for update of j skip locked limit 10),claimed as (
 update push_jobs j set attempts=j.attempts+1,next_attempt_at=now()+interval '10 minutes' from jobs where jobs.id=j.id returning j.id,j.notification_id
 )select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'notification_id',n.id,'user_id',n.user_id,'kind',n.kind,'ref_id',n.ref_id,'title',n.title,'body',n.body)),'[]')
 from claimed c join notifications n on n.id=c.notification_id;
$$ language sql security definer set search_path=public;
create function get_notification_preferences() returns jsonb as $$
 select jsonb_build_object('pushEnabled',push_enabled) from profiles where id=auth.uid();
$$ language sql stable security definer set search_path=public;
create function set_push_enabled(p_enabled boolean) returns void as $$
begin
 if p_enabled is null or not account_active(auth.uid()) then raise exception 'Account unavailable';end if;
 update profiles set push_enabled=p_enabled where id=auth.uid();
 -- Do not deliver the muted backlog when notifications are enabled again.
 if not p_enabled then update push_jobs set sent_at=now(),last_error='disabled by user' where notification_id in(select id from notifications where user_id=auth.uid()) and sent_at is null;end if;
end;
$$ language plpgsql security definer set search_path=public;
create or replace function queue_notification_push() returns trigger as $$
begin
 if exists(select 1 from profiles where id=new.user_id and push_enabled) and notification_allowed(new.user_id,new.kind,new.ref_id) then
 insert into push_jobs(notification_id) values(new.id) on conflict do nothing;end if;return new;
end;
$$ language plpgsql security definer set search_path=public;
revoke all on function claim_push_receipts() from public,anon,authenticated;
grant execute on function claim_push_receipts() to service_role;
revoke all on function get_notification_preferences(),set_push_enabled(boolean) from public,anon;
grant execute on function get_notification_preferences(),set_push_enabled(boolean) to authenticated;
create function guard_active_push_token() returns trigger as $$
begin if not account_active(new.user_id) then raise exception 'Account unavailable';end if;return new;end;
$$ language plpgsql security definer set search_path=public;
create trigger active_push_token before insert or update on push_tokens for each row execute function guard_active_push_token();
create or replace function maintenance_retention_cleanup() returns void as $$
begin
 delete from content_reports where reviewed_at<now()-interval '90 days';
 delete from push_deliveries where created_at<now()-interval '30 days';
 delete from push_jobs where notification_id in(select id from notifications where created_at<now()-interval '30 days');
end;
$$ language plpgsql security definer set search_path=public;
commit;
