-- Migration 00009 — offers lifecycle + atomic bookings + venue claims.
--
-- Offers: draft -> live -> ended/cancelled. Only VERIFIED businesses may
-- publish (guard_offer_publish); drafts are free to create.
-- Bookings: create_booking() locks the offer row so concurrent bookings for
-- the same slot serialize — capacity can never be overbooked. Capacity is
-- derived (sum of party_size over pending/confirmed), so cancellations free
-- seats automatically.

alter table offers
  add column if not exists venue_id uuid references venues(id),
  add column if not exists price_cents int check (price_cents is null or price_cents >= 0),
  add column if not exists slot_capacity int not null default 10
    check (slot_capacity > 0);

alter table offers drop constraint if exists offers_status_check;
alter table offers add constraint offers_status_check
  check (status in ('draft', 'live', 'ended', 'cancelled'));

-- Server-side publish gate: only verified businesses go live.
create or replace function guard_offer_publish() returns trigger as $$
declare
  v_verification text;
begin
  if new.status = 'live' and (tg_op = 'INSERT' or old.status is distinct from 'live') then
    select verification_status into v_verification from profiles where id = new.business_id;
    if v_verification is distinct from 'verified' then
      raise exception 'only verified businesses can publish offers';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_guard_offer_publish on offers;
create trigger trg_guard_offer_publish
  before insert or update of status on offers
  for each row execute function guard_offer_publish();

-- Atomic booking with per-slot capacity. Slots are exact timestamps sent by
-- the client (minute precision); the offer window bounds them.
create or replace function create_booking(
  p_offer_id uuid,
  p_slot timestamptz,
  p_party_size int
) returns json as $$
declare
  v_business uuid;
  v_status text;
  v_starts timestamptz;
  v_ends timestamptz;
  v_capacity int;
  v_taken int;
  v_customer uuid;
  v_booking_id uuid;
begin
  v_customer := auth.uid();
  if v_customer is null then
    raise exception 'not authenticated';
  end if;
  if p_party_size < 1 or p_party_size > 50 then
    raise exception 'party size must be between 1 and 50';
  end if;

  -- Serialize concurrent bookings for this offer.
  select business_id, status, starts_at, ends_at, slot_capacity
    into v_business, v_status, v_starts, v_ends, v_capacity
  from offers where id = p_offer_id for update;
  if not found then
    raise exception 'offer not found';
  end if;
  if v_status != 'live' then
    raise exception 'offer is not live';
  end if;
  if v_business = v_customer then
    raise exception 'cannot book your own offer';
  end if;
  if p_slot < v_starts or p_slot > v_ends then
    raise exception 'slot is outside the offer window';
  end if;
  if p_slot <= now() then
    raise exception 'slot must be in the future';
  end if;

  select coalesce(sum(party_size), 0) into v_taken from bookings
  where offer_id = p_offer_id and slot = p_slot and status in ('pending', 'confirmed');
  if v_taken + p_party_size > v_capacity then
    raise exception 'not enough seats left for this slot';
  end if;

  insert into bookings (offer_id, customer_id, slot, party_size, status)
  values (p_offer_id, v_customer, p_slot, p_party_size, 'pending')
  returning id into v_booking_id;

  return json_build_object(
    'booking_id', v_booking_id,
    'seats_left', v_capacity - v_taken - p_party_size
  );
end;
$$ language plpgsql security definer set search_path = public;

-- Business claims an unclaimed venue (sets business_id). Business accounts only.
create or replace function claim_venue(p_venue_id uuid) returns void as $$
declare
  v_acct text;
begin
  select account_type into v_acct from profiles where id = auth.uid();
  if v_acct is distinct from 'business' then
    raise exception 'only business accounts can claim venues';
  end if;
  update venues set business_id = auth.uid()
  where id = p_venue_id and business_id is null;
  if not found then
    raise exception 'venue not found or already claimed';
  end if;
end;
$$ language plpgsql security definer set search_path = public;

-- Business view: bookings across my offers with customer + offer context.
create or replace view business_bookings as
select
  b.*,
  o.business_id,
  o.title as offer_title,
  c.display_name as customer_name
from bookings b
join offers o on o.id = b.offer_id
join profiles c on c.id = b.customer_id;

alter view business_bookings set (security_invoker = true);
grant select on business_bookings to authenticated;
