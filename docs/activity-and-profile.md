# Personal Activity and Profile

Activity separates three jobs that previously shared one long feed:

- **My plans**: requests sent to other people's posts, labelled Waiting for host or You're going.
- **Requests**: people asking to join your posts, grouped by the plan you host. Review, approve or decline here.
- **Bookings**: reservations made through business offers, with their confirmation status and business chat.

My plans and Bookings have Upcoming and History filters. Ended, cancelled, withdrawn,
declined and full requests, plus expired booking holds, stay discoverable in History.
Date checks apply before backend maintenance has updated the stored status. The
Activity tab uses a calendar icon to distinguish it from the notifications bell.
My posts remains a prominent shortcut for managing hosted plans.

Leaving, withdrawing and cancelling use inline confirmation, followed by a named
result. A shared action lock prevents overlapping mutations and chat creation.
Existing authorized services/RPCs, subscriptions, periodic refresh and retry are
retained. Pull-to-refresh is also available. No new database migration is required.

Profile shows a compact identity card with Edit profile, then two groups:

- **Your space**: My posts, My activity, Messages and Notifications. Unread counts remain live.
- **Settings & privacy**: Safety & privacy, Notification preferences and Privacy policy.

Blocked people, reports, terms and account deletion remain accessible under Safety
& privacy. Email is shown separately as the signed-in account, and Log out stays at
the bottom. Demo mode remains clearly labelled and can switch to the business demo.

## Verification

Automated activity tests cover waiting/accepted requests, terminal request states,
plan start/cancellation boundaries, booking hold expiry, and confirmed/past bookings.
Browser smoke checks cover empty states and Profile destinations. An isolated copy
with temporary fixtures exercises incoming approval, withdrawal into History,
booking cancellation confirmation and narrow-screen settings; those fixtures are
not part of the app or its demo data.

On a physical phone, check normal and enlarged text, pull-to-refresh, long names,
request approval/decline, leaving a confirmed plan, cancellation, business chat,
unread updates, Edit profile, safety settings, and returning from a details screen.
