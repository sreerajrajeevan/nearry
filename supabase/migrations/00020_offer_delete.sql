-- Draft-only hard delete for offers. Drafts with bookings must be cancelled, not deleted.
begin;
create or replace function delete_offer(p_offer_id uuid) returns void as $$
declare o offers;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select * into o from offers where id = p_offer_id and business_id = auth.uid() for update;
 if not found then raise exception 'offer not found or not yours'; end if;
 if o.status <> 'draft' then raise exception 'only drafts can be deleted'; end if;
 if exists (select 1 from bookings where offer_id = o.id) then raise exception 'offer has bookings'; end if;
 delete from offer_slots where offer_id = o.id;
 delete from offers where id = o.id;
end;
$$ language plpgsql security definer set search_path=public;
revoke all on function delete_offer(uuid) from public, anon;
grant execute on function delete_offer(uuid) to authenticated;
commit;
