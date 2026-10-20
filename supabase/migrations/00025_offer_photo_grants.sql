-- ============================================================
-- Migration 00025 — offer cover photo / spotlight permissions
-- 00023 added offers.cover_photo_url + is_spotlight, but the
-- column-level INSERT grant (00012) never covered them, so any
-- offer insert fails with "permission denied for table offers".
-- update_offer (00017) also rejects those keys in patches.
-- ============================================================

grant insert(cover_photo_url, is_spotlight) on public.offers to authenticated;

create or replace function update_offer(p_offer_id uuid,p_patch jsonb) returns jsonb as $$
declare o offers; p profiles;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 if p_patch is null or jsonb_typeof(p_patch)<>'object' then raise exception 'invalid offer patch'; end if;
 if exists(select 1 from jsonb_object_keys(p_patch) k where k not in
  ('title','description','discount_pct','price_cents','starts_at','ends_at','venue_id','slot_capacity','slot_minutes','resource_key','status','cover_photo_url','is_spotlight')) then raise exception 'protected offer field'; end if;
 select * into p from profiles where id=auth.uid() for update;
 select * into o from offers where id=p_offer_id and business_id=auth.uid() for update;
 if not found then raise exception 'offer not found or not yours'; end if;
 update offers set
 title=case when p_patch?'title' then btrim(p_patch->>'title') else title end,
 description=case when p_patch?'description' then btrim(p_patch->>'description') else description end,
 discount_pct=case when p_patch?'discount_pct' then (p_patch->>'discount_pct')::int else discount_pct end,
 price_cents=case when p_patch?'price_cents' then (p_patch->>'price_cents')::int else price_cents end,
 starts_at=case when p_patch?'starts_at' then (p_patch->>'starts_at')::timestamptz else starts_at end,
 ends_at=case when p_patch?'ends_at' then (p_patch->>'ends_at')::timestamptz else ends_at end,
 venue_id=case when p_patch?'venue_id' then (p_patch->>'venue_id')::uuid else venue_id end,
 slot_capacity=case when p_patch?'slot_capacity' then (p_patch->>'slot_capacity')::int else slot_capacity end,
 slot_minutes=case when p_patch?'slot_minutes' then (p_patch->>'slot_minutes')::int else slot_minutes end,
 resource_key=case when p_patch?'resource_key' then btrim(p_patch->>'resource_key') else resource_key end,
 status=case when p_patch?'status' then p_patch->>'status' else status end,
 cover_photo_url=case when p_patch?'cover_photo_url' then nullif(p_patch->>'cover_photo_url','') else cover_photo_url end,
 is_spotlight=case when p_patch?'is_spotlight' then (p_patch->>'is_spotlight')::boolean else is_spotlight end
 where id=o.id returning * into o;
 return to_jsonb(o)||jsonb_build_object('business',jsonb_build_object('display_name',coalesce(p.business_name,p.display_name)));
end;
$$ language plpgsql security definer set search_path=public;

revoke all on function update_offer(uuid,jsonb) from public,anon;
grant execute on function update_offer(uuid,jsonb) to authenticated;
