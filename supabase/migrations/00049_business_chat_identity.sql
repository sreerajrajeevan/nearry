-- Business chats are named after the business, not the person behind it.
--
-- A business account's display_name is the owner's own name ("Renil"); the
-- place customers know is business_name. Chat lists, the conversation header
-- and message notifications now carry both, so the app can show the business
-- name as the title and the person's name underneath.
--
-- Additive only: existing keys keep their meaning, so older app builds keep
-- working. Requires 00026 (list_my_conversations) and 00024 (conversation_safety).

-- The name customers see for an account: business name for businesses.
create or replace function chat_display_name(p profiles) returns text
language sql stable set search_path = public as $$
  select case
    when p.account_type = 'business' and nullif(btrim(p.business_name), '') is not null
      then btrim(p.business_name)
    else p.display_name
  end
$$;
revoke all on function chat_display_name(profiles) from public, anon, authenticated;

create or replace function list_my_conversations() returns json as $$
 select coalesce(json_agg(row_to_json(t) order by t.last_at desc nulls last,t.id),'[]'::json) from (
  select c.id, p.id as other_user_id,p.display_name as other_name,
    (p.account_type='business') as other_is_business,
    case when p.account_type='business' then nullif(btrim(p.business_name),'') end as other_business_name,
    c.post_id,c.booking_id,
    coalesce(post.title,offer.title) as context_title,last_msg.body as last_body,last_msg.created_at as last_at,
    (select count(*) from messages m where m.conversation_id=c.id and m.sender_id<>auth.uid()
      and m.created_at>greatest(coalesce(r.last_read_at,'1970-01-01'::timestamptz),coalesce(d.cleared_at,'1970-01-01'::timestamptz))) as unread_count
  from conversations c
  join profiles p on p.id=case when c.user_a=auth.uid() then c.user_b else c.user_a end
  left join posts post on post.id=c.post_id
  left join bookings b on b.id=c.booking_id
  left join offers offer on offer.id=b.offer_id
  left join conversation_clears d on d.conversation_id=c.id and d.user_id=auth.uid()
  left join conversation_reads r on r.conversation_id=c.id and r.user_id=auth.uid()
  left join lateral (select m.body,m.created_at from messages m where m.conversation_id=c.id
    and (d.cleared_at is null or m.created_at>d.cleared_at) order by m.created_at desc,m.id desc limit 1) last_msg on true
  where auth.uid() in(c.user_a,c.user_b) and account_active(auth.uid()) and account_active(p.id)
    and not users_blocked(auth.uid(),p.id) and (d.cleared_at is null or last_msg.created_at is not null)
 ) t;
$$ language sql stable security definer set search_path=public;
revoke all on function list_my_conversations() from public,anon;
grant execute on function list_my_conversations() to authenticated;

create or replace function conversation_safety(p_conversation uuid) returns jsonb as $$
 select jsonb_build_object('userId',p.id,'name',p.display_name,
   'isBusiness',p.account_type='business',
   'businessName',case when p.account_type='business' then nullif(btrim(p.business_name),'') end,
   'kind',case when c.booking_id is not null then 'booking' else 'plan' end,
   'contextTitle',coalesce(post.title,offer.title),
   'canMessage',account_active(c.user_a) and account_active(c.user_b) and not users_blocked(c.user_a,c.user_b),
   'blockedByMe',exists(select 1 from user_blocks where blocker_id=auth.uid() and blocked_id=p.id))
 from conversations c join profiles p on p.id=case when c.user_a=auth.uid() then c.user_b else c.user_a end
 left join posts post on post.id=c.post_id
 left join bookings b on b.id=c.booking_id
 left join offers offer on offer.id=b.offer_id
 where c.id=p_conversation and auth.uid() in(c.user_a,c.user_b);
$$ language sql stable security definer set search_path=public;

-- "Message from Café Nine", not "Message from Renil".
create or replace function notify_message() returns trigger as $$
declare recipient uuid; sender_name text;
begin
 select case when c.user_a=new.sender_id then c.user_b else c.user_a end
 into recipient from conversations c where c.id=new.conversation_id;
 select chat_display_name(p) into sender_name from profiles p where p.id=new.sender_id;
 insert into notifications(user_id,kind,title,body,ref_id,message_id)
 values(recipient,'message','Message from '||coalesce(sender_name,'someone'),left(new.body,140),new.conversation_id,new.id);
 return new;
end;
$$ language plpgsql security definer set search_path=public;

notify pgrst, 'reload schema';
