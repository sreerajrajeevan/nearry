# Simple Nearby and plan details

The Nearby feed and plan details use the existing forest/cream theme with quieter
headers, generous side photos, activity categories, readable metadata and fewer
competing panels. `PostRow` is shared with Search so plan results stay consistent.
The Personal Create tab has a small solid green plus button.

Feed rows place an uploaded photo on the left (40% of the row width, at least
154 pixels tall) and the category, title, date, location, host and spots on the
right. Covers stretch with the text instead of becoming thin horizontal strips.
The default cover aspect ratio used elsewhere remains unchanged. There are no enclosing card
panels or decorative badges, apart from audience restrictions that remain visible.
The compact header keeps the existing logo, location picker, messages and unread
notifications. Search and a separate 44-pixel filter button share one quiet field.
Categories and the free-only toggle live inside the filter panel; an applied-filter
indicator and summary keep their state visible when the panel closes. Date tabs
remain directly on the feed. Changing filters does not force a scroll jump.
Three sample rows fit at 390×844; narrower phones, longer titles, audience
restrictions and larger system text can need more room. Text is allowed
to grow rather than being forced into a fixed card height. Details retain their
larger gallery, and the safe-area-aware tab bar has no selected background pill.

Nearby excludes posts authored by the signed-in account, including after filter
changes/reset and cached feed updates. This only affects home discovery: hosted
posts remain available under Activity → My posts with their management actions.
The existing location/area scope still applies. Identity matching uses the
author ID, so a different host with the same display name is not hidden.

Nearby has working All plans / Today / This weekend filters and a Free plans only
toggle. Calendar filters use the device's local day boundaries; Saturday and
Sunday include the current weekend. A focus/resume-aware clock updates at minute
boundaries, including midnight, so cached plans that have started or expired are
removed without manual refresh. The feed combines date/category/free conditions
against one clock. Date labels also handle New Year and daylight-saving changes.
Unknown costs do not count as free. These
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

Validation: TypeScript passed; 178 local tests (173 passed, 5 PostgreSQL-only
skips); Android/web production exports passed. Date regression tests also passed
separately under Asia/Kolkata and America/New_York, covering every weekday,
weekend midnight bounds, year/DST changes, combined filters/reset, cached expiry,
invalid timestamps, cancelled/closed plans, full plans and unknown costs.
Actual app checks in an isolated demo at 390×844 and 320×600 covered photo/text
placement, audience badges, no horizontal overflow and fully visible tab labels.
A local attached-image fixture rendered at 142×154 pixels and the row opened the
full gallery and participation footer. Today/weekend were rechecked after the
layout change. Earlier passes also checked category/free filters and reset, empty
results and search navigation. A host-account demo confirmed its own post was
absent from Nearby (also after Today/reset), other hosts remained visible, and
the same owned post stayed available in Activity → My posts.
The earlier checks in this PR covered request/withdraw, gender/profile gates,
host approval/edit and photo/safety reporting. No production records were modified.
Native share/maps, large system fonts, TalkBack/VoiceOver and gesture navigation
still need testing on a phone build.
