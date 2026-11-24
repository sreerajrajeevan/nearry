# Plan reminders: design

**Why:** people forget same-day plans or quietly drop out, and hosts find out at the venue. On the day of a plan, Nearry reminds everyone in it, asks members whether they're still going, and makes leaving easy so hosts can find replacements early.

## Behaviour

- **Push reminder on the day.** Sent to the host and every approved member of a plan that isn't cancelled. It goes out at 8:00 am India time, or 2 hours before the start if that is earlier (a 7:00 am plan reminds at 5:00 am). One reminder per person per plan.
  - Member: "Today: Saturday football", "7:00 pm at Kaloor Turf. Still going?"
  - Host: "You're hosting today: Saturday football", "7:00 pm at Kaloor Turf. 2 of 3 confirmed so far."
  - Tapping it opens the plan.
- **"Plans for today" pop-up** when the app opens on a day the person has plans that haven't started yet. Each plan shows once per day; answering or closing hides it until tomorrow.
  - Members get **Going** and **Not going**.
  - **Not going** records the answer and opens the plan page with a "Leave this plan?" confirmation. Nothing changes until they confirm, so a mis-tap can't remove them.
  - Hosts see "You're hosting · 2 of 3 confirmed" (no buttons).
- **Host sees confirmations:** the plan page shows "2 of 3 confirmed for today" on the day.

## Decisions

- Host visibility: hosts see the count of members who tapped Going (recommended earlier; the user said to go ahead).
- "India time" is fixed (`Asia/Kolkata`), matching the rest of the app's day logic.
- Answers are stored in `plan_attendance` (post, member, going/not going). Only the database writes it, through `set_plan_attendance`, which accepts only approved members. Members read their own answer; the host reads the answers for their plan.
- Reminders go through the existing notifications → push pipeline (new kind `plan_reminder`), so push on/off settings and blocking already apply.
- A scheduled job runs every 10 minutes (`nearry-plan-reminders` in `supabase/ops/setup-maintenance.sql`).

## Non-goals

No reminder for plans on other days, no repeated nagging, no automatic removal for "Not going".
