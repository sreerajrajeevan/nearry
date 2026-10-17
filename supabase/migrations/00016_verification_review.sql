-- 00016 — Email review flow for business verification.
--
-- When a business submits a verification document (status -> 'pending'), a
-- trigger fires an HTTP call (pg_net, async background worker) to the
-- `notify-verification` edge function, which emails the admin the document
-- with one-click approve / reject-with-reason links.
--
-- Run this file in the Supabase dashboard SQL editor (one-shot paste).
-- The edge functions must be deployed separately (see supabase/functions/).

-- Rejection reason shown to the business in the app.
alter table profiles
  add column if not exists verification_note text;

-- Notification kinds for verification decisions (business gets an in-app
-- notification + push when the admin approves or rejects).
alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check check (
  kind in (
    'join_request', 'request_approved', 'request_declined',
    'booking', 'booking_confirmed', 'booking_cancelled', 'message',
    'verification_approved', 'verification_rejected'
  )
);

-- Webhook trigger: status flips to 'pending' -> ping the edge function.
create or replace function notify_verification_pending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verification_status = 'pending'
     and old.verification_status is distinct from 'pending' then
    perform net.http_post(
      url := 'https://ggeejgykahzquynwighw.supabase.co/functions/v1/notify-verification',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('user_id', new.id),
      timeout_milliseconds := 5000
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_verification_pending on profiles;
create trigger trg_notify_verification_pending
  after update of verification_status on profiles
  for each row
  execute function notify_verification_pending();
