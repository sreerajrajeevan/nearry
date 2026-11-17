-- Booking notices say when, where and how to pay.
--
-- The old confirmation read only '"<offer>" — see you there': no time, no
-- business, nothing about payment. Nearry takes no payment, so a customer must
-- know to pay at the venue. Times are shown in India time (Asia/Kolkata),
-- matching the one-booking-per-day rule in 00041.
--
-- Same kinds, recipients and ref_id (the offer id) as before; only the title
-- and body text change. Safe to apply to an existing project; existing
-- notifications are not rewritten.

create or replace function booking_notice_when(p_slot timestamptz) returns text
language sql immutable set search_path = public as $$
  select to_char(p_slot at time zone 'Asia/Kolkata', 'Dy FMDD Mon, FMHH12:MI AM')
$$;
revoke all on function booking_notice_when(timestamptz) from public, anon, authenticated;

-- 19900 -> '199', 4950 -> '49.50'
create or replace function booking_notice_rupees(p_cents int) returns text
language sql immutable set search_path = public as $$
  select case when p_cents % 100 = 0 then (p_cents / 100)::text
              else to_char(p_cents / 100.0, 'FM999999990.00') end
$$;
revoke all on function booking_notice_rupees(int) from public, anon, authenticated;

create or replace function notify_booking() returns trigger as $$
declare
  v_title text;
  v_body text;
  v_user uuid;
  v_kind text;
  v_offer text;
  v_business text;
  v_business_id uuid;
  v_price int;
  v_when text := booking_notice_when(new.slot);
  v_people text := new.party_size || case when new.party_size = 1 then ' person' else ' people' end;
begin
  select o.title, o.business_id, o.price_cents, coalesce(nullif(btrim(pr.display_name), ''), 'the business')
    into v_offer, v_business_id, v_price, v_business
  from offers o left join profiles pr on pr.id = o.business_id
  where o.id = new.offer_id;

  if tg_op = 'INSERT' then
    v_kind := 'booking';
    v_user := v_business_id;
    v_title := 'New booking request';
    select coalesce(nullif(btrim(pr.display_name), ''), 'Someone')
           || ' wants ' || v_people || ' for "' || v_offer || '" · ' || v_when
           || '. Waiting for you to confirm.'
      into v_body from profiles pr where pr.id = new.customer_id;
    v_body := coalesce(v_body, 'New request for "' || v_offer || '" · ' || v_when);
  elsif tg_op = 'UPDATE' and new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    v_kind := 'booking_confirmed';
    v_user := new.customer_id;
    v_title := 'Booking confirmed';
    v_body := '"' || v_offer || '" at ' || v_business || ' · ' || v_when || ' · ' || v_people || '. '
      || case
           when v_price = 0 then 'It''s free.'
           when v_price > 0 then 'Pay ₹' || booking_notice_rupees(v_price) || ' at the venue.'
           else 'Pay at the venue.'
         end;
  elsif tg_op = 'UPDATE' and new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    v_kind := 'booking_cancelled';
    -- notify the other party, whoever cancelled
    v_user := case when new.customer_id = auth.uid() then v_business_id else new.customer_id end;
    v_title := 'Booking cancelled';
    v_body := '"' || v_offer || '" · ' || v_when || ' was cancelled.';
  else
    return new;
  end if;

  insert into notifications (user_id, kind, title, body, ref_id)
  values (v_user, v_kind, v_title, v_body, new.offer_id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

notify pgrst, 'reload schema';
