# Simple Nearby and plan details

The Nearby feed and plan details use the existing forest/cream theme with quieter
headers, compact photo summaries, activity categories, readable metadata and fewer
competing panels. `PostRow` is shared with Search so plan results stay consistent.
The Personal Create tab has a small solid green plus button.

Feed rows use a 96-pixel photo with title, date, place, host and available spots
beside it. Category illustrations are small and unboxed; date filters use
underlined tabs. The large welcome heading and redundant All locations caption
have been removed. Changing category keeps the current scroll position rather
than jumping the page. Details retain their larger gallery.

Nearby has working All plans / Today / This weekend filters and a Free plans only
toggle. Calendar filters use the device's local day boundaries; Saturday and
Sunday include the current weekend. Unknown costs do not count as free. These
filters apply to plans; offers and venues remain in their own sections and the
duplicate featured-offer presentation has been removed. Location search,
attribution, refresh, categories, messages and notifications remain available.

Rows display uploaded cover photos and public host avatars when available.
Missing/failed covers use the existing activity illustrations; failed avatars
use initials. No stock photography is presented as a real venue or plan. Avatar
lookups select only public ID/avatar fields, deduplicate and batch IDs, and are
optional: a failed lookup does not hide the feed. No database changes are needed.

Details put the gallery first, followed by the host, date/time, venue, available
spots, description and audience. The footer remains outside the scroller with
the price and current participation action. Unknown prices say Cost not specified.
Directions use the saved venue/area, without inventing a distance. Share opens
the platform share interface with readable plan information, not a fabricated
deep link. Report/block live in the Plan options sheet; photo reporting stays in
the viewer. Host approval, edit, cancel/delete, participant withdrawal/leave,
profile readiness and gender restrictions retain their existing service rules.
Participant names are not exposed beyond existing backend access rules.

Validation: TypeScript, the full local test suite, Android/web production exports,
and the actual app in an isolated browser demo at 390×844 and 320×600. Browser
checks covered date/category/free filters and reset, empty results, request and
withdraw, gender mismatch, incomplete-profile prompt, host approval/edit,
report/block controls, and attached-photo viewing/report navigation. All sample
data and photo attachments stayed local; no production records were modified.
Native share/maps, large system fonts, TalkBack/VoiceOver and gesture navigation
still need testing on a phone build.
