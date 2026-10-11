# Nearry M7 acceptance checklist

For the rebuild that includes everything through M6 (chat + notifications).
Tick off what passes; anything that fails goes straight onto the M7 fix list.

## Before you start
- [ ] Fresh APK installed — the "backend not configured" banner is gone
- You'll need **3 accounts** (A, B, C). One phone works if you log out / in
  between; a second phone makes the realtime + chat parts much easier.
  Email OTP works for each account.

## 1. Core gate — posts + join requests (M1–M4)
- [ ] As A (personal): Create Post → "Need 2 players at Unity Turf", capacity 2,
      future date/time
- [ ] As B: open the post, request to join. Same as C.
- [ ] As A: approve B, then approve C → post shows **0 spots left and closes**
- [ ] Force-close the app, reopen → everything still there (state survives restart)

## 2. Business — verification, offers, bookings (M5)
- [ ] As a business account: Dashboard shows real metrics (live / drafts /
      bookings / seats) and the verification badge
- [ ] Business profile → upload a proof document → status becomes **pending**
- [ ] Still unverified: create an offer, save as draft, try to publish →
      **publish should be blocked** (verification gate)
- [ ] (Optional, in the Supabase dashboard — SQL is documented in migration
      00008) flip the business to verified
- [ ] Publish the offer → it appears in Nearby on the personal side as a live offer
- [ ] As a personal user: OfferDetails → pick slot date/time + seats → book →
      booking appears under Activity → **MY BOOKINGS**
- [ ] Business: Bookings screen → booking shows up → confirm one, cancel a test one
- [ ] Overbooking check: bookings can't exceed the slot's seat capacity

## 3. Chat + notifications (M6)
- [ ] As B (approved participant): on the post tap **MESSAGE**, or as A tap
      **MESSAGE HOST** → conversation opens → send a message
- [ ] The other side sees the message appear in realtime; an unread badge shows
      on Activity (personal) / Messages (business)
- [ ] Messages tab → chat list shows the conversation with the unread count
- [ ] Bell icon → Notification Center lists join_request / approved / booking /
      message entries
- [ ] With the app open, trigger an event from the other account →
      local notification banner appears.
      **Note:** true background push needs the `send-push` edge function
      deployed (`supabase functions deploy send-push`) — not deployed yet, so
      only expect in-app + foreground local notifications for now.
- [ ] Booking chat: customer ↔ business conversation from a booking works both ways

## Done?
Reply with pass / fail per section and paste anything that looks wrong
(error text or a screenshot). Failures become the M7 fix list.
