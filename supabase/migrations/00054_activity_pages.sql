begin;
create function public.activity_requests(p_history boolean default false,p_cursor jsonb default null,p_limit int default 30) returns jsonb as $$
declare result jsonb;lim int=least(80,greatest(1,coalesce(p_limit,30)));
begin
 if not account_active(auth.uid()) then raise exception 'Account unavailable';end if;
 with page as materialized(
 select j.*,p.title post_title,p.status post_status,p.starts_at post_starts_at
 from join_requests j left join posts p on p.id=j.post_id where j.requester_id=auth.uid()
 and (coalesce(p.status='cancelled' or p.starts_at<=now(),true) or j.status in('withdrawn','declined','full'))=coalesce(p_history,false)
 and(p_cursor is null or (j.created_at,j.id)<((p_cursor->>'at')::timestamptz,(p_cursor->>'id')::uuid))
 order by j.created_at desc,j.id desc limit lim+1
 ), numbered as(select *,row_number() over(order by created_at desc,id desc) rn from page)
 select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(numbered)-'rn' order by rn) filter(where rn<=lim),'[]'),
 'cursor',case when count(*)>lim then(select jsonb_build_object('at',created_at,'id',id) from numbered where rn=lim)else null end) into result from numbered;
 return result;
end;
$$ language plpgsql stable security invoker set search_path=public,pg_temp;
create function public.host_request_page(p_cursor jsonb default null,p_limit int default 30) returns jsonb as $$
declare result jsonb;lim int=least(80,greatest(1,coalesce(p_limit,30)));
begin
 if not account_active(auth.uid()) then raise exception 'Account unavailable';end if;
 with page as materialized(
 select j.*,u.display_name requester_name,u.avatar_url requester_avatar
 from join_requests j join posts p on p.id=j.post_id join profiles u on u.id=j.requester_id
 where p.author_id=auth.uid() and j.status='pending' and p.status in('open','closed') and p.starts_at>now() and(p.expires_at is null or p.expires_at>now())
 and(p_cursor is null or (j.created_at,j.id)<((p_cursor->>'at')::timestamptz,(p_cursor->>'id')::uuid))
 order by j.created_at desc,j.id desc limit lim+1
 ), numbered as(select *,row_number() over(order by created_at desc,id desc) rn from page),
 cards as(select n.rn,n.created_at,n.id,to_jsonb(n)-'rn'||jsonb_build_object('post',to_jsonb(p)) item from numbered n join post_cards p on p.id=n.post_id where rn<=lim)
 select jsonb_build_object('items',coalesce((select jsonb_agg(item order by rn) from cards),'[]'),
 'cursor',case when exists(select 1 from numbered where rn>lim) then(select jsonb_build_object('at',created_at,'id',id) from cards order by rn desc limit 1)else null end) into result;
 return result;
end;
$$ language plpgsql stable security invoker set search_path=public,pg_temp;
revoke all on function public.activity_requests(boolean,jsonb,int),public.host_request_page(jsonb,int) from public,anon;
grant execute on function public.activity_requests(boolean,jsonb,int),public.host_request_page(jsonb,int) to authenticated;
create index joins_requester_page on join_requests(requester_id,created_at desc,id desc);

create function public.business_day_summary(p_from timestamptz,p_until timestamptz) returns jsonb as $$
begin
 if not account_active(auth.uid()) or p_until<=p_from or p_until-p_from>interval '2 days' then raise exception 'Choose a valid day';end if;
 return jsonb_build_object(
 'today',(select count(*) from business_bookings where business_id=auth.uid() and slot>=p_from and slot<p_until and status<>'cancelled'),
 'waiting',(select count(*) from business_bookings where business_id=auth.uid() and slot>=p_from and slot<p_until and slot>now() and status='pending' and(hold_expires_at is null or hold_expires_at>now())),
 'liveOffers',(select count(*) from offers where business_id=auth.uid() and status='live' and ends_at>now()),
 'drafts',(select count(*) from offers where business_id=auth.uid() and status='draft'));
end;
$$ language plpgsql stable security invoker set search_path=public,pg_temp;
revoke all on function public.business_day_summary(timestamptz,timestamptz) from public,anon;
grant execute on function public.business_day_summary(timestamptz,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;