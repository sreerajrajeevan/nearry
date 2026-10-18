# Core journey verification

## This change

- Saved offers have a **My offers** manager, linked from Dashboard and Business. Drafts can be reopened, edited and published after verification; live offers can be edited without changing their reserved slots, or ended. A publish retry keeps the saved draft ID.
- Business Bookings can cancel a future confirmed booking. Expired holds are labelled correctly even before a scheduler sweep. Party size matches the server limit of 50.
- Retrying the same active slot reservation with the same party size returns its existing booking, so a lost response does not reserve twice. Changing party size requires managing the existing booking.
- Post details respect cancellation, expiry, full capacity and past start times. Editing a post can change or clear its request closing time. Cancelling a post notifies pending and approved participants.
- Activity, post details, offer details, Dashboard and Bookings ignore stale requests, refresh after returning/reconnecting/resuming, and provide retry states.
- Chat preserves newer send/realtime results, recovers after reconnect, retries load failures, and only acknowledges displayed messages while the app is foregrounded. Notifications open the relevant workflow.
- Badges use one authorized database snapshot. Message notices and unread messages do not count twice; reading a conversation clears notices only through the displayed message.
- Returning to an existing session no longer remounts navigation. Profile refresh preserves the current app while surfacing action failures. Auth/onboarding actions reject overlapping submissions; denied location remains optional.

## Database rollout

Apply **only `00021_core_journeys.sql`** to an existing project already at `00020`, after the checks pass and following the existing backup procedure. Never run `run-all.sql` against an existing database. It is an additive migration plus replacements of authorized functions, preserving existing records. The matching app requires `unread_counts()` for badges. No Edge Function changes or mail/push delivery setup are part of this step.

## Phone checks

Use two real Personal accounts (A host, B participant) and one verified Business account (C). A second device or a separate web session helps observe updates. New users must complete onboarding; do not temporarily bypass verification or authorization.

| Journey | Check | Expected |
| --- | --- | --- |
| Email and Google | Sign up, complete onboarding, log out and log back in; try the opposite account lane | Email uses a code and no phone; existing role is retained, with an explanation for a different lane |
| Session | Restart the app; switch away and back while viewing details or chat | Account restores and the current screen survives normal session refresh |
| Post | A creates a post, opens My posts, edits details and clears a closing time | Saved changes appear in My posts and details |
| Join | B requests; A approves; B leaves, requests again; A declines | Capacity, request state and notifications update for both accounts |
| Capacity | Two different people compete for the last place | Only one approval succeeds; counts never exceed capacity |
| Cancellation | A cancels with a pending or approved participant | Both see the cancelled plan; participants receive an in-app notice; join/approval controls stop |
| Offers | C saves a draft, reopens it from My offers, edits and publishes | One draft is retained, publishing is verification-gated and valid slots appear |
| Booking | A books a slot; C confirms; C cancels the confirmed booking | Status updates, A is notified and the slot becomes available |
| Booking retry | Retry a request after a weak-connection response; try the same slot again | Same active booking is returned for the same party size, rather than reserving twice |
| Expiry | Leave a pending booking until its hold passes | It is shown as Expired and cannot be confirmed; actual sweeping remains the scheduler's job |
| Chat | Approved host/participant and booking customer/business exchange messages | Outsiders cannot access chat; return from background to fetch missed messages |
| Reads | Receive two messages, view the first snapshot while a new message arrives | Only displayed messages are acknowledged; the new message remains unread |
| Notices | Tap a post, booking, verification or message notification | It opens the correct workflow; chat is not counted twice in Activity |
| Connection | Disable internet during a load, restore it and retry | Clear error/retry behaviour; no stale response replaces newer data |

## Evidence and limits

Automated tests run against disposable databases and mocked HTTP boundaries. They do not create accounts, bookings, posts or messages in the live project. Google redirects, actual OTP delivery and device behaviour require the phone checks above. Remote push, mail workers and scheduler deployment remain Step 3; arbitrary searched-place posting remains Step 5. An automated pass is not a claim that the phone checks have passed.
