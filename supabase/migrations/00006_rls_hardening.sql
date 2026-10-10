-- Migration 00006 — RLS hardening for the join-request lifecycle.
--
-- 1. Approvals MUST go through approve_join_request() (row-locked, atomic).
--    Direct updates can only decline/withdraw; setting 'approved' directly
--    is rejected so capacity can never be bypassed.
-- 2. Insert guard: no self-join, and only into open, unexpired posts.
--    (The RPC re-checks all of this; RLS is defense in depth.)

drop policy if exists "jr author update" on join_requests;
create policy "jr author update" on join_requests for update
  using (
    exists (select 1 from posts p
            where p.id = join_requests.post_id and p.author_id = auth.uid())
  )
  with check (
    status <> 'approved'
    and exists (select 1 from posts p
                where p.id = join_requests.post_id and p.author_id = auth.uid())
  );

drop policy if exists "jr insert" on join_requests;
create policy "jr insert" on join_requests for insert with check (
  auth.uid() = requester_id
  and not exists (
    select 1 from posts p where p.id = post_id and p.author_id = auth.uid()
  )
  and exists (
    select 1 from posts p
    where p.id = post_id
      and p.status = 'open'
      and (p.expires_at is null or p.expires_at > now())
  )
);
