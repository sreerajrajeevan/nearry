-- Private, durable verification delivery and atomic reviews. No network extension required.
begin;
create table verification_review_jobs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references profiles(id) on delete cascade,
 document_path text not null,
 created_at timestamptz not null default now(),
 attempts int not null default 0,
 next_attempt_at timestamptz not null default now(),
 sent_at timestamptz,
 last_error text,
 reviewed_at timestamptz,
 decision text check(decision in ('approved','rejected'))
);
alter table verification_review_jobs enable row level security;
revoke all on verification_review_jobs from public,anon,authenticated;
grant all on verification_review_jobs to service_role;
create index verification_jobs_delivery on verification_review_jobs(next_attempt_at) where sent_at is null and reviewed_at is null;

create or replace function clear_verification_note() returns trigger as $$
begin
 if new.verification_status='pending' and old.verification_status is distinct from 'pending' then new.verification_note:=null; end if;
 return new;
end;
$$ language plpgsql;
create trigger trg_clear_verification_note before update of verification_status on profiles
 for each row execute function clear_verification_note();

create or replace function notify_verification_pending() returns trigger as $$
begin
 if new.verification_status='pending' and (old.verification_status is distinct from 'pending' or old.verification_doc_path is distinct from new.verification_doc_path) then
  -- Supersede old links even if an administrator rejected outside the review RPC
  -- and the owner deliberately reuses the same storage path.
  update verification_review_jobs set reviewed_at=now() where user_id=new.id and reviewed_at is null;
  insert into verification_review_jobs(user_id,document_path) values(new.id,new.verification_doc_path);
 end if;
 return new;
end;
$$ language plpgsql security definer set search_path=public;
-- Any pending submissions predating this migration also need delivery.
insert into verification_review_jobs(user_id,document_path)
 select id,verification_doc_path from profiles where verification_status='pending' and verification_doc_path is not null;

create or replace function claim_verification_jobs() returns setof verification_review_jobs as $$
begin
 return query with due as (
  select j.id from verification_review_jobs j join profiles p on p.id=j.user_id
  where j.sent_at is null and j.reviewed_at is null and j.next_attempt_at<=now() and j.attempts<8
   and j.created_at>now()-interval '7 days'
   and p.verification_status='pending' and p.verification_doc_path=j.document_path
  order by j.created_at limit 10 for update of j skip locked
 ) update verification_review_jobs j set attempts=j.attempts+1,next_attempt_at=now()+interval '5 minutes'
 from due where j.id=due.id returning j.*;
end;
$$ language plpgsql security definer set search_path=public;
revoke all on function claim_verification_jobs() from public,anon,authenticated;
grant execute on function claim_verification_jobs() to service_role;

create or replace function review_verification(p_review_id uuid,p_decision text,p_reason text default null) returns void as $$
declare j verification_review_jobs;p profiles; note text;
begin
 if p_decision is null or p_decision not in ('approved','rejected') or char_length(coalesce(p_reason,''))>200 then raise exception 'invalid decision';end if;
 select * into j from verification_review_jobs where id=p_review_id;
 if not found then raise exception 'review unavailable';end if;
 -- Match submit_verification's profile-first lock order.
 select * into p from profiles where id=j.user_id for update;
 select * into j from verification_review_jobs where id=p_review_id for update;
 if j.reviewed_at is not null or j.created_at<=now()-interval '7 days' or p.verification_status<>'pending'
   or p.verification_doc_path is distinct from j.document_path then raise exception 'review expired, stale, or already completed';end if;
 note:=case when p_decision='rejected' then coalesce(nullif(btrim(p_reason),''),'Please submit a clearer, valid business document.') else null end;
 update profiles set verification_status=case when p_decision='approved' then 'verified' else 'rejected' end,verification_note=note where id=p.id;
 update verification_review_jobs set reviewed_at=now(),decision=p_decision where id=j.id;
 insert into notifications(user_id,kind,title,body) values(p.id,
  case when p_decision='approved' then 'verification_approved' else 'verification_rejected' end,
  case when p_decision='approved' then 'Verification approved' else 'Verification needs attention' end,
  case when p_decision='approved' then 'Your business is verified. You can now publish offers.' else note end);
end;
$$ language plpgsql security definer set search_path=public;
revoke all on function review_verification(uuid,text,text) from public,anon,authenticated;
grant execute on function review_verification(uuid,text,text) to service_role;
commit;
