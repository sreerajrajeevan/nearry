-- Migration 00010 — 1:1 chat, notifications, push tokens.
--
-- Chat is AUTHORIZED: a conversation can only be opened between a post
-- author and an approved participant (post scope), or between a booking's
-- customer and business (booking scope). get_or_create_conversation()
-- enforces this server-side; there is no direct client insert path.
--
-- Notifications are written by security-definer triggers on join_requests,
-- bookings and messages. Remote push delivery goes through the
-- `send-push` edge function (supabase/functions/send-push), invoked by the
-- app after the triggering action; see its README.

-- ── Conversations & messages ──────────────────────────────

create table conversations (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  booking_id uuid references bookings(id) on delete cascade,
  user_a uuid not null references profiles(id) on delete cascade,
  user_b uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (post_id is not null or booking_id is not null),
  check (user_a != user_b)
);

-- One conversation per (context, unordered pair).
create unique index conv_post_unique
  on conversations (post_id, user_a, user_b) where booking_id is null;
create unique index conv_booking_unique
  on conversations (booking_id, user_a, user_b) where post_id is null;

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_conv_idx on messages (conversation_id, created_at);

create table conversation_reads (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table conversations enable row level security;
alter table messages enable row level security;
alter table conversation_reads enable row level security;

create policy "members read conversations" on conversations for select
  using (auth.uid() = user_a or auth.uid() = user_b);

create policy "members read messages" on messages for select
  using (exists (
    select 1 from conversations c
    where c.id = messages.conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
  ));

create policy "members send messages" on messages for insert
  with check (
    sender_id = auth.uid() and exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

create policy "users manage own reads" on conversation_reads for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Authorized conversation creation ─────────────────────

create or replace function get_or_create_conversation(
  p_other_user uuid,
  p_post_id uuid default null,
  p_booking_id uuid default null
) returns uuid as $$
declare
  v_me uuid := auth.uid();
  v_a uuid;
  v_b uuid;
  v_conv uuid;
  v_author uuid;
  v_customer uuid;
  v_business uuid;
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;
  if p_other_user = v_me then
    raise exception 'cannot chat with yourself';
  end if;
  if not exists (select 1 from profiles where id = p_other_user) then
    raise exception 'user not found';
  end if;
  if (p_post_id is null) = (p_booking_id is null) then
    raise exception 'provide exactly one of post_id or booking_id';
  end if;

  if p_post_id is not null then
    -- post scope: author <-> approved participant, either direction
    select author_id into v_author from posts where id = p_post_id;
    if not found then
      raise exception 'post not found';
    end if;
    if not (
      (v_author = v_me and exists (
        select 1 from join_requests
        where post_id = p_post_id and requester_id = p_other_user and status = 'approved'))
      or
      (v_author = p_other_user and exists (
        select 1 from join_requests
        where post_id = p_post_id and requester_id = v_me and status = 'approved'))
    ) then
      raise exception 'chat not allowed for this post';
    end if;
  else
    -- booking scope: customer <-> business, either direction
    select b.customer_id, o.business_id into v_customer, v_business
    from bookings b join offers o on o.id = b.offer_id
    where b.id = p_booking_id;
    if not found then
      raise exception 'booking not found';
    end if;
    if not ((v_customer = v_me and v_business = p_other_user)
         or (v_business = v_me and v_customer = p_other_user)) then
      raise exception 'chat not allowed for this booking';
    end if;
  end if;

  -- canonical member ordering so the unique index dedupes both directions
  v_a := least(v_me, p_other_user);
  v_b := greatest(v_me, p_other_user);

  select c.id into v_conv from conversations c
  where c.post_id is not distinct from p_post_id
    and c.booking_id is not distinct from p_booking_id
    and c.user_a = v_a and c.user_b = v_b;

  if v_conv is null then
    begin
      insert into conversations (post_id, booking_id, user_a, user_b)
      values (p_post_id, p_booking_id, v_a, v_b)
      returning id into v_conv;
    exception when unique_violation then
      -- lost a race with another creator; fetch the winner
      select c.id into v_conv from conversations c
      where c.post_id is not distinct from p_post_id
        and c.booking_id is not distinct from p_booking_id
        and c.user_a = v_a and c.user_b = v_b;
    end;
  end if;
  return v_conv;
end;
$$ language plpgsql security definer set search_path = public;

-- ── Chat list with unread counts ──────────────────────────

create or replace function list_my_conversations() returns json as $$
  select coalesce(json_agg(row_to_json(t) order by t.last_at desc nulls last), '[]'::json)
  from (
    select
      c.id,
      case when c.user_a = auth.uid() then c.user_b else c.user_a end as other_user_id,
      p.display_name as other_name,
      c.post_id,
      c.booking_id,
      coalesce(post.title, offer.title) as context_title,
      (select m.body from messages m
        where m.conversation_id = c.id order by m.created_at desc limit 1) as last_body,
      (select m.created_at from messages m
        where m.conversation_id = c.id order by m.created_at desc limit 1) as last_at,
      (select count(*) from messages m
        where m.conversation_id = c.id
          and m.sender_id != auth.uid()
          and m.created_at > coalesce((
            select r.last_read_at from conversation_reads r
            where r.conversation_id = c.id and r.user_id = auth.uid()
          ), '1970-01-01'::timestamptz)) as unread_count
    from conversations c
    join profiles p
      on p.id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
    left join posts post on post.id = c.post_id
    left join bookings b on b.id = c.booking_id
    left join offers offer on offer.id = b.offer_id
    where c.user_a = auth.uid() or c.user_b = auth.uid()
  ) t;
$$ language sql security definer set search_path = public;

create or replace function mark_conversation_read(p_conversation_id uuid) returns void as $$
begin
  if not exists (
    select 1 from conversations
    where id = p_conversation_id
      and (user_a = auth.uid() or user_b = auth.uid())
  ) then
    raise exception 'not a conversation member';
  end if;
  insert into conversation_reads (conversation_id, user_id, last_read_at)
  values (p_conversation_id, auth.uid(), now())
  on conflict (conversation_id, user_id) do update set last_read_at = now();
end;
$$ language plpgsql security definer set search_path = public;

-- ── Push tokens ───────────────────────────────────────────

create table push_tokens (
  user_id uuid not null references profiles(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('android', 'ios')),
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

alter table push_tokens enable row level security;

create policy "users manage own tokens" on push_tokens for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── In-app notifications ──────────────────────────────────

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in (
    'join_request', 'request_approved', 'request_declined',
    'booking', 'booking_confirmed', 'booking_cancelled', 'message'
  )),
  title text not null,
  body text not null,
  ref_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id, created_at desc);

alter table notifications enable row level security;

create policy "users read own notifications" on notifications for select
  using (auth.uid() = user_id);

create policy "users mark own notifications read" on notifications for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Event -> notification writers (security definer: only triggers write).

create or replace function notify_join_request() returns trigger as $$
declare
  v_title text;
  v_body text;
  v_user uuid;
  v_kind text;
begin
  if tg_op = 'INSERT' then
    v_kind := 'join_request';
    select p.author_id into v_user from posts p where p.id = new.post_id;
    select 'New join request',
           pr.display_name || ' wants to join "' || p.title || '"'
      into v_title, v_body
    from profiles pr, posts p
    where pr.id = new.requester_id and p.id = new.post_id;
  elsif tg_op = 'UPDATE' and new.status = 'approved' and old.status is distinct from 'approved' then
    v_kind := 'request_approved';
    v_user := new.requester_id;
    select 'Request approved', 'You''re in! "' || p.title || '"'
      into v_title, v_body from posts p where p.id = new.post_id;
  elsif tg_op = 'UPDATE' and new.status = 'declined' and old.status is distinct from 'declined' then
    v_kind := 'request_declined';
    v_user := new.requester_id;
    select 'Request declined', '"' || p.title || '" didn''t work out this time'
      into v_title, v_body from posts p where p.id = new.post_id;
  else
    return new;
  end if;

  insert into notifications (user_id, kind, title, body, ref_id)
  values (v_user, v_kind, v_title, v_body, new.post_id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notify_join_request on join_requests;
create trigger trg_notify_join_request
  after insert or update of status on join_requests
  for each row execute function notify_join_request();

create or replace function notify_booking() returns trigger as $$
declare
  v_title text;
  v_body text;
  v_user uuid;
  v_kind text;
begin
  if tg_op = 'INSERT' then
    v_kind := 'booking';
    select o.business_id into v_user from offers o where o.id = new.offer_id;
    select 'New booking',
           pr.display_name || ' booked ' || new.party_size || ' seat(s) for "' || o.title || '"'
      into v_title, v_body
    from profiles pr, offers o
    where pr.id = new.customer_id and o.id = new.offer_id;
  elsif tg_op = 'UPDATE' and new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    v_kind := 'booking_confirmed';
    v_user := new.customer_id;
    select 'Booking confirmed', '"' || o.title || '" — see you there'
      into v_title, v_body from offers o where o.id = new.offer_id;
  elsif tg_op = 'UPDATE' and new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    v_kind := 'booking_cancelled';
    -- notify the other party, whoever cancelled
    select case when new.customer_id = auth.uid() then o.business_id else new.customer_id end
      into v_user from offers o where o.id = new.offer_id;
    select 'Booking cancelled', '"' || o.title || '" was cancelled'
      into v_title, v_body from offers o where o.id = new.offer_id;
  else
    return new;
  end if;

  insert into notifications (user_id, kind, title, body, ref_id)
  values (v_user, v_kind, v_title, v_body, new.offer_id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notify_booking on bookings;
create trigger trg_notify_booking
  after insert or update of status on bookings
  for each row execute function notify_booking();

create or replace function notify_message() returns trigger as $$
declare
  v_user uuid;
  v_name text;
begin
  select case when c.user_a = new.sender_id then c.user_b else c.user_a end
    into v_user from conversations c where c.id = new.conversation_id;
  select display_name into v_name from profiles where id = new.sender_id;
  insert into notifications (user_id, kind, title, body, ref_id)
  values (v_user, 'message', 'Message from ' || coalesce(v_name, 'someone'),
          left(new.body, 140), new.conversation_id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notify_message on messages;
create trigger trg_notify_message
  after insert on messages
  for each row execute function notify_message();
