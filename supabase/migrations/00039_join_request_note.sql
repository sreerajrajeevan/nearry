-- An optional note with a join request ("I'll bring the football").
-- Visible only to the requester and the host, through the existing
-- "jr read involved" policy. Kept on the request, never posted to chat.
begin;
alter table join_requests add column note text;
alter table join_requests add constraint join_request_note_length
  check (note is null or char_length(note) between 1 and 280);

drop function public.request_join(uuid);
create function public.request_join(p_post_id uuid, p_note text default null)
returns jsonb as $$
declare p posts; r join_requests; v_note text := nullif(btrim(p_note), '');
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if char_length(v_note) > 280 then raise exception 'Keep your note under 280 characters'; end if;
  if not exists(select 1 from profiles where id = auth.uid() and account_type = 'personal' and onboarding_completed) then raise exception 'personal onboarding required'; end if;
  select * into p from posts where id = p_post_id for update;
  if not found or p.author_id = auth.uid() then raise exception 'post not found or cannot join your own post'; end if;
  if p.status <> 'open' or coalesce(p.expires_at,p.starts_at) <= now() or p.starts_at <= now() then raise exception 'post is closed or expired'; end if;
  if (select count(*) from join_requests where post_id=p.id and status='approved') >= p.vacancies then raise exception 'post is full'; end if;
  select * into r from join_requests where post_id=p.id and requester_id=auth.uid() for update;
  if found and r.status in ('pending','approved') then raise exception 'you already requested or joined this post'; end if;
  if found and r.decline_count >= 2 then raise exception 'no more requests allowed for this post'; end if;
  if r.id is null then
    insert into join_requests(post_id,requester_id,status,note)
      values(p.id,auth.uid(),'pending',v_note) returning * into r;
  else
    -- Re-request after a decline/withdrawal: fresh row (new id) so the host
    -- is notified again, carrying the decline count forward.
    delete from join_requests where id=r.id;
    insert into join_requests(post_id,requester_id,status,decline_count,note)
      values(p.id,auth.uid(),'pending',r.decline_count,v_note) returning * into r;
  end if;
  return to_jsonb(r);
end;
$$ language plpgsql security definer set search_path = public;
revoke execute on function public.request_join(uuid, text) from public, anon, authenticated;
grant execute on function public.request_join(uuid, text) to authenticated;
commit;
