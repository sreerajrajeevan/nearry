-- Booking reminders: on the day of a confirmed offer booking, the customer
-- gets one push at 8:00 am India time, or 2 hours before an earlier slot.
-- Pending (unconfirmed) and cancelled bookings get none. They sit under the
-- "Bookings" notification switch. Scheduled every 10 minutes by
-- ops/setup-maintenance.sql (job nearry-booking-reminders).
begin;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'join_request','request_approved','request_declined','request_full','post_cancelled',
  'booking','booking_confirmed','booking_cancelled','message','verification_approved',
  'verification_rejected','selfie_review','plan_group_message','plan_reminder','nearby_plan',
  'booking_reminder'));

create or replace function public.notification_category(p_kind text) returns text
language sql immutable set search_path=public,pg_temp as $$
  select case
    when p_kind in ('message','plan_group_message') then 'messages'
    when p_kind in ('join_request','request_approved','request_declined','request_full','post_cancelled','plan_reminder') then 'plans'
    when p_kind in ('booking','booking_confirmed','booking_cancelled','booking_reminder') then 'bookings'
    when p_kind = 'nearby_plan' then 'nearby'
  end
$$;
revoke all on function public.notification_category(text) from public, anon, authenticated;

-- One row per booking already reminded, so each booking gets one push.
create table public.booking_reminder_log(
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  sent_at timestamptz not null default now()
);
alter table public.booking_reminder_log enable row level security;
revoke all on public.booking_reminder_log from public, anon, authenticated;
grant all on public.booking_reminder_log to service_role;

create or replace function public.send_booking_reminders(p_now timestamptz default now()) returns int as $$
declare sent int;
begin
 with due as (
  select b.id, b.customer_id, b.offer_id, b.party_size, o.title, s.starts_at,
   coalesce(v.name, nullif(pr.business_name, ''), 'the venue') place,
   lower(to_char(timezone('Asia/Kolkata', s.starts_at), 'FMHH12:MI am')) at_time
  from bookings b
  join offer_slots s on s.id = b.slot_id
  join offers o on o.id = b.offer_id
  join profiles pr on pr.id = o.business_id
  left join venues v on v.id = o.venue_id
  where b.status = 'confirmed'
   and s.starts_at > p_now
   and s.starts_at <= p_now + interval '24 hours'
   and timezone('Asia/Kolkata', s.starts_at)::date = timezone('Asia/Kolkata', p_now)::date
   and p_now >= least(
     (timezone('Asia/Kolkata', s.starts_at)::date + time '08:00') at time zone 'Asia/Kolkata',
     s.starts_at - interval '2 hours')
   and account_active(b.customer_id)
 ),
 logged as (
  insert into booking_reminder_log(booking_id)
  select id from due on conflict do nothing
  returning booking_id
 ),
 inserted as (
  insert into notifications(user_id, kind, ref_id, title, body)
  select d.customer_id, 'booking_reminder', d.offer_id,
   'Today: ' || d.title,
   d.at_time || ' at ' || d.place || ' · ' || d.party_size
     || case when d.party_size = 1 then ' person' else ' people' end
     || '. Can''t make it? Cancel it in the app so someone else can book.'
  from due d join logged l on l.booking_id = d.id
  returning 1
 )
 select count(*) into sent from inserted;
 return sent;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.send_booking_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.send_booking_reminders(timestamptz) to service_role;

notify pgrst, 'reload schema';
commit;
