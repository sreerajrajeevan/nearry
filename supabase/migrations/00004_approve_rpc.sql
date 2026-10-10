-- Migration 00004 — atomic join-request approval + withdrawal.
--
-- approve_join_request() locks the post row (FOR UPDATE) so concurrent
-- approvals serialize: capacity can never be overfilled. It enforces, in
-- order: request exists & pending, post open & unexpired, no self-join,
-- caller is the post author, capacity remains. On fill, the post closes.
--
-- Withdrawals (delete, or status -> withdrawn/declined) reopen a post that
-- was closed only because it filled up — never an expired one.

create or replace function approve_join_request(p_request_id uuid)
returns json as $$
declare
  v_post_id uuid;
  v_author uuid;
  v_requester uuid;
  v_req_status text;
  v_vacancies int;
  v_approved int;
  v_post_status text;
  v_expires timestamptz;
begin
  select post_id, requester_id, status
    into v_post_id, v_requester, v_req_status
  from join_requests where id = p_request_id for update;
  if not found then
    raise exception 'join request not found';
  end if;
  if v_req_status != 'pending' then
    raise exception 'join request is not pending';
  end if;

  -- Serialize concurrent approvals on the post row.
  select author_id, vacancies, status, expires_at
    into v_author, v_vacancies, v_post_status, v_expires
  from posts where id = v_post_id for update;
  if not found then
    raise exception 'post not found';
  end if;
  if v_author != auth.uid() then
    raise exception 'only the host can approve join requests';
  end if;
  if v_requester = v_author then
    raise exception 'cannot join your own post';
  end if;
  if v_post_status != 'open' then
    raise exception 'post is not open';
  end if;
  if v_expires is not null and v_expires <= now() then
    update posts set status = 'closed' where id = v_post_id;
    raise exception 'post has expired';
  end if;

  select count(*) into v_approved from join_requests
  where post_id = v_post_id and status = 'approved';
  if v_approved >= v_vacancies then
    raise exception 'post is already full';
  end if;

  update join_requests set status = 'approved' where id = p_request_id;

  if v_approved + 1 >= v_vacancies then
    update posts set status = 'closed' where id = v_post_id;
  end if;

  return json_build_object(
    'approved', true,
    'spots_left', greatest(v_vacancies - v_approved - 1, 0),
    'post_closed', (v_approved + 1) >= v_vacancies
  );
end;
$$ language plpgsql security definer set search_path = public;

-- Reopen a post closed by filling up when an approved join is withdrawn
-- or declined afterwards. Expired posts stay closed.
create or replace function reopen_post_if_space() returns trigger as $$
declare
  v_post_id uuid;
  v_vacancies int;
  v_post_status text;
  v_expires timestamptz;
  v_approved int;
begin
  v_post_id := old.post_id;
  if tg_op = 'UPDATE' and new.status = 'approved' then
    return new; -- still approved: nothing to release
  end if;

  select vacancies, status, expires_at
    into v_vacancies, v_post_status, v_expires
  from posts where id = v_post_id;
  if not found then
    return coalesce(new, old);
  end if;

  select count(*) into v_approved from join_requests
  where post_id = v_post_id and status = 'approved';

  if v_post_status = 'closed'
     and v_approved < v_vacancies
     and (v_expires is null or v_expires > now()) then
    update posts set status = 'open' where id = v_post_id;
  end if;

  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_reopen_post_on_withdraw on join_requests;
create trigger trg_reopen_post_on_withdraw
  after update of status or delete on join_requests
  for each row execute function reopen_post_if_space();

-- The baseline close-when-full trigger stays as a backstop for any
-- approval path that doesn't go through the RPC.
