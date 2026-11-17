# "Players needed" alerts, auto-accept and the turf QR card

Status: proposed · 2026-11-17 · owner: Sree

## Why

A team that is short of players a few hours before a game has no fast way to
fill the spot. Today a Nearry plan just sits in the Nearby feed; nobody is told
about it. Turf owners lose money when such a team cancels, so they have a reason
to hand Nearry to every team that books, which makes them free distribution.

Success: a host posts "need 2 players at 7 pm" at 5 pm and has them by 6 pm,
and turf owners keep the QR card at their counter.

## Goals

1. **Urgent plans.** When creating a plan that starts within the next 6 hours,
   the host can switch on "Players needed now". Saving it alerts nearby people.
2. **Nearby alert.** Everyone nearby who has the alert switched on gets a push
   notification. "Nearby" means the plan's meeting place is within the distance
   that person chose at sign-up (2, 5, 10 or 25 km; 5 km if they never chose).
   Interests are not used (Sree's call: "look for nearby only").
3. **Auto-accept.** The host can choose "Accept people automatically until full":
   requests are approved instantly while spots remain; the group chat opens as
   it does after a normal approval.
4. **Turf QR card.** A business with a verified venue gets a "Players short?"
   card in the business app: a QR code plus a share button. Scanning it opens
   Nearry's new-plan screen with the venue, today's date and "Players needed
   now" already filled in. People without the app go to the Play Store.
5. **Notification settings.** In Settings → Notifications, next to the existing
   "Push notifications" switch:
   - Messages (private chats and group chats)
   - Plan requests and updates (join requests, accepted/declined, plan full,
     plan cancelled)
   - Bookings (new, confirmed, cancelled)
   - Nearby players needed: shows the alert area with "Change" and "Remove"
6. **Sign-up area is kept.** The area chosen at sign-up is no longer deleted
   after 29 days. Sign-up stays optional and gains one line: "Add your area to
   hear when nearby players are needed."

## Non-goals

No ranking or matching by skill, no SMS/WhatsApp sending, no live location,
no payments, no alerts for business offers, no editing "urgent" after the plan
is posted (prevents re-alerting the same people).

## Anti-goals (would be a failure even if it works)

- Spam that makes people switch off all notifications.
- Revealing anyone's location: the host never sees who was alerted or where
  anyone lives; people only ever see the plan's meeting place.
- Alerting people who could not join (women-only plans, age range, blocks).

## Constraints

- Everything is enforced in the database, so a modified app cannot bypass
  limits, eligibility or switches (Sree's call: all database).
- Pushes go through the existing pipeline (notifications → push_jobs → the
  `send-push` worker on its one-minute schedule). No new server function.
- Old app builds must keep working after the migration.
- Privacy policy and Play Data safety must say the area is kept until the user
  removes it or deletes their account.

## Approaches

1. **All in the database (chosen).** An insert trigger on urgent plans finds
   recipients and inserts `nearby_plan` notifications; existing push delivery
   sends them. Auto-accept, limits and notification switches are also checked
   in SQL. Reuses what already runs; one place for safety rules.
2. **A separate server function** that searches and sends. More flexible later
   (ranking), but another deploy, secret and schedule, and it would duplicate
   the safety checks. Rejected for now.

## Decided details

**Who is alerted** for an urgent plan, all of:
- personal account, onboarding done, active, not the host;
- not blocked either way with the host;
- passes the plan's audience rules (gender preference, age range);
- has not already requested this plan;
- has an alert area, and the plan's meeting place is within their distance;
- "Nearby players needed" switched on;
- has had fewer than 3 nearby alerts today (India time).
At most 200 people per plan, nearest first.

**Host limits:** at most 2 urgent plans per day (India time). Urgent is only
allowed when the plan starts in the future and within 6 hours.

**Alert text:** title "Players needed nearby"; body like
"Football at Smash Turf · 7:00 PM · 2 spots · 1.2 km". Tapping opens the plan.

**Area storage:** the existing `onboarding_preferences.area`. Areas from the
phone's GPS are rounded to 2 decimal places (about 1 km) when saved, and
existing GPS areas are rounded once by the migration. Searched areas are kept
as they are. The 29-day cleanup of the area is removed. Users can change or
remove the area in notification settings.

**Notification switches** are stored per person; they control push for their
categories (the in-app notification list still shows everything), except
"Nearby players needed", which stops the alert being created at all. Account
notices (verification, selfie review) are always sent.

**QR link:** `<share page>?newplan=<venue id>`, opening
`nearry://new-plan?venue=<id>`. Only verified venues get a card. This relies
on the hosted share page (`open.html`, see docs/share-links.md); until that is
set up, the card uses the `nearry://` link, which works for people who already
have the app.

## Left to the builder

Exact copy and layout of new controls; migration number (next free: 00050);
how the QR is drawn (no new native dependency preferred); tests in the existing
style (PGlite database tests, unit tests for link parsing and settings).
