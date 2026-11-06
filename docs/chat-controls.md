# Chat composer and inbox controls

The shared Personal and Business inbox supports long press and a visible three-dot button. The conversation header offers the same menu.

- **Delete conversation** asks for confirmation. `delete_my_conversation` stores a server-owned clear boundary for the signed-in member, removes their old history from message reads/previews, and acknowledges old unread messages/notices. It never deletes shared message rows. A new message revives the inbox entry with only messages after the clear boundary. There is no undo or unsend-for-everyone action.
- **Report conversation** opens the existing reason/details form. The server validates membership, resolves the other member and preserves the latest 20 messages in the private moderation snapshot. Existing report limits and deduplication apply. Moderators can dismiss or suspend the reported account; removal requires a report on a specific message.
- **Block person** asks for confirmation and uses the existing mutual server-enforced block. Existing commitments remain manageable; unblock from Safety & privacy.

Apply only `supabase/migrations/00026_chat_inbox_controls.sql` to an existing installation after earlier migrations. Do not replay `run-all.sql`. This migration creates the per-member state table and adds restrictive message-read protection. App users cannot write clear boundaries directly. Account/conversation deletion cascades remove the new state automatically. No existing chat is cleared by installing the migration.

The chat screen has one window-sized keyboard-avoiding view outside safe-area padding, with `padding` behavior on both native platforms. The transcript shrinks; the compact header and composer do not. Enter inserts a newline, and the separate Send button submits. A synchronous lock prevents repeated taps while sending; failures retain the draft and show an inline retry hint. Poll/realtime snapshots replace the transcript so another device's clear does not restore old bubbles.

## Verification

Automated database tests cover per-member isolation, unread reset, empty chats, revival, forged state, nonmembers, account/conversation cascades and private/deduplicated reports. Service tests check the real Supabase request boundary. Isolated browser checks cover both inboxes, long press and visible options, cancellation, reports, blocking, deletion, narrow layouts, multiline drafts, simulated viewport shrink, failed-send retry and duplicate taps.

Before release, install the updated phone build and check the actual system keyboard on Android and iOS: open/close, type a long multiline message, scroll history, send without dismissing, rotate, and return from background. Browser viewport checks and a successful Android JavaScript export do not verify a device keyboard. Test with two disposable accounts to confirm Delete for me affects only one history and a new message revives the chat. Older history pagination beyond the newest 200 visible messages remains future work.
