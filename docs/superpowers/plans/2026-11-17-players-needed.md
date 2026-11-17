# Players Needed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a host mark a plan "Players needed now" so nearby people are alerted, optionally auto-accept joiners, give turfs a QR card that opens a pre-filled plan (or the Play Store), and let people choose which notifications they get.

**Architecture:** Everything that decides who is alerted, limits, auto-accept and per-category push lives in one forward migration (`00050`). The app adds two switches to the plan editor, a richer notification settings screen, a `new-plan` deep link, and a business QR screen. The hosted `open.html` gains a `newplan` case and is published on a `gh-pages` branch.

**Tech Stack:** Expo / React Native (TypeScript), Supabase Postgres + PostGIS, PGlite database tests (`tests/database.test.ts`), `node:test` via `tsx`, `qrcode-generator` (MIT, pure JS) for the QR.

**Spec:** `docs/superpowers/specs/2026-11-17-players-needed-design.md`

## Global Constraints

- Urgent only when the plan starts in the future and within **6 hours**; cannot be changed after posting.
- Host: at most **2 urgent plans per day**; recipient: at most **3 nearby alerts per day**; at most **200 recipients per plan**, nearest first. "Day" = India time (`Asia/Kolkata`).
- "Nearby" = plan point within the recipient's `onboarding_preferences.radiusKm` (2/5/10/25), **5 km** when unset. Plan point = `posts.location_lat/lng`, else the venue's `location`.
- Interests are **not** used.
- Alert: kind `nearby_plan`, title **"Players needed nearby"**, body `"<title>" at <place> · <h:mm AM> · <n> spots · <d.d> km`, `ref_id` = post id.
- Notification categories: `messages` (message, plan_group_message), `plans` (join_request, request_approved, request_declined, request_full, post_cancelled), `bookings` (booking, booking_confirmed, booking_cancelled), `nearby` (nearby_plan). Account notices are never gated. `messages/plans/bookings` gate **push only**; `nearby` off means the alert is **not created**.
- Sign-up area is kept until the user changes/removes it or deletes the account; areas with `source='device'` are rounded to **2 decimals**.
- QR always encodes `<share page>?newplan=<venue id>`; no share page configured → no QR shown. Only verified venues.
- Old app builds keep working (new columns default false; RPC return shapes only gain keys).
- No new native dependency.

## Review Focus

- A plan at a Nearry venue (`venue_id` set, no lat/lng) still alerts people near the venue → test in Task 2.
- A person whose area has a label but no coordinates (manual "area name only") is never alerted and nothing errors → test in Task 2.
- Auto-accept never bypasses the women-only / age / block rules, and stops at capacity (later requests get "post is full") → test in Task 2.
- Turning "Nearby players needed" off, or removing the area, stops alerts immediately → test in Task 1/2.
- Opening a `new-plan` link while signed out or as a business account does nothing harmful (no crash, no navigation) → test in Task 5.

---

### Task 1: Notification categories, kept and rounded alert area (database)

**Files:**
- Create: `supabase/migrations/00050_players_needed.sql` (part 1)
- Modify: `supabase/migrations/README.md`, `supabase/run-all.sql` (via `npm run sql:generate`)
- Test: `tests/database.test.ts` (append)

**Interfaces:**
- Produces (SQL):
  - `profiles.notification_settings jsonb not null default '{}'` (keys `messages|plans|bookings|nearby` → boolean; missing = on).
  - `notification_category(p_kind text) returns text` (null for ungated kinds).
  - `notification_category_enabled(p_user uuid, p_kind text) returns boolean`.
  - `get_notification_preferences() returns jsonb` → `{pushEnabled, messages, plans, bookings, nearby, alertArea: {label}|null}`.
  - `set_notification_category(p_category text, p_enabled boolean) returns void` (rejects unknown category).
  - `set_alert_area(p_area jsonb) returns void` (null removes; validated with `valid_onboarding_preferences(jsonb_build_object('area',p_area))`).
  - Trigger `round_device_area` (BEFORE INSERT/UPDATE OF onboarding_preferences on profiles).
  - `notifications_kind_check` gains `'nearby_plan'`.

- [ ] **Step 1: Write failing tests** `test("notification switches gate push per category; account notices always push")` and `test("alert area is kept, rounded when from GPS, and removable")`. Assertions: with `plans` off, a `join_request` notification creates no `push_jobs` row but a `message` does; `verification_approved` always queues; `set_notification_category('nope',false)` rejects; `set_alert_area` with `{label:'Kakkanad',latitude:10.016789,longitude:76.341234,source:'device',acquiredAt:'…'}` stores `10.02, 76.34`; a `source:'google'` area is stored unchanged; running `maintenance_retention_cleanup()` with `acquiredAt` 40 days old keeps the area; `set_alert_area(null)` removes it; `get_notification_preferences()` returns all categories `true` by default and `alertArea.label='Kakkanad'`.
- [ ] **Step 2: Run** `npx tsx --test --test-name-pattern="notification switches|alert area" tests/database.test.ts` → FAIL.
- [ ] **Step 3: Implement part 1 of `00050`.** Redefine `maintenance_retention_before_selfie_poses()` without the `onboarding_preferences-'area'` update (keep its business_details cleanup). Redefine `queue_notification_push()` adding `and notification_category_enabled(new.user_id,new.kind)`. Grant execute on the two RPCs to `authenticated`, revoke from `public, anon`; helpers revoked from all client roles.
- [ ] **Step 4: Run** the same tests → PASS; `npm run sql:generate && npm run sql:check`.
- [ ] **Step 5: Commit** `feat(db): notification categories and kept alert area`.

### Task 2: Urgent plans, nearby alerts, auto-accept (database)

**Files:**
- Modify: `supabase/migrations/00050_players_needed.sql` (part 2)
- Test: `tests/database.test.ts` (append)

**Interfaces:**
- Consumes: Task 1 (`notification_settings`, `nearby_plan` kind).
- Produces (SQL):
  - `posts.urgent boolean not null default false`, `posts.auto_accept boolean not null default false`; insert grant on both to `authenticated`; neither updatable (trigger rejects changes).
  - `post_cards` view: same columns in the same order plus `urgent, auto_accept` appended.
  - Trigger `guard_urgent_plan` (BEFORE INSERT/UPDATE on posts): urgent needs `starts_at > now()` and `<= now()+6h`; host's urgent plans today (India) < 2; `urgent`/`auto_accept` immutable on update. Messages: `'Players needed now is only for plans starting within 6 hours'`, `'You can post 2 urgent plans a day'`, `'Urgent and auto-accept can't be changed after posting'`.
  - Trigger `alert_nearby_players` (AFTER INSERT on posts, when `new.urgent`): inserts `nearby_plan` notifications per Global Constraints. Eligibility: `personal_profile_ready(id)`, not host, `not users_blocked(host,id)`, gender preference, age range from `plan_details`, has area with numeric lat/lng, `notification_settings->>'nearby'` not `'false'`, under daily cap.
  - `notification_allowed` gains: `nearby_plan` → `account_active(p_user)` and post exists, open, `content_visible('post',p_ref)`, host not blocked.
  - `request_join(uuid,text)`: after the pending row is written, if `auto_accept`, set it `approved` (existing triggers enforce eligibility/capacity and close the plan when full).
  - `notify_join_request`: for auto-accept plans, skip the host's "wants to join" notice on insert; on approval also notify the host: title `'New player joined'`, body `'<name> joined "<title>"'`, kind `join_request`.
- [ ] **Step 1: Write failing tests** `test("urgent plans alert eligible people nearby, nearest first, within limits")`, `test("urgent plan rules: 6 hours, 2 a day, cannot change after posting")`, `test("auto-accept joins instantly, respects audience and capacity, tells the host")`. Assertions cover: person 3 km away (radius 5) alerted, 8 km away not, radius 10 at 8 km alerted; venue-only plan alerts by venue location; manual area without coordinates not alerted; host not alerted; blocked, wrong-gender, out-of-age not alerted; `nearby` off not alerted; 4th urgent plan of the day for one recipient not alerted; body equals `'"Football tonight" at Unity Turf · 7:00 PM · 2 spots · 3.0 km'`-style (compute the expected time with the same SQL formatter); a non-urgent plan alerts nobody; urgent starting in 7 h rejected; 3rd urgent plan by a host rejected; `update posts set urgent=false` rejected; auto-accept request returns `status='approved'`, requester gets `request_approved`, host gets `'New player joined'`, a male requester on a women-only auto-accept plan is rejected, joining past capacity raises `post is full`.
- [ ] **Step 2: Run** `npx tsx --test --test-name-pattern="urgent|auto-accept" tests/database.test.ts` → FAIL.
- [ ] **Step 3: Implement part 2 of `00050`.** Recreate `post_cards` with the exact 00036 select list plus `p.urgent,p.auto_accept`. Recipient query uses PostGIS `st_dwithin`/`st_distance` on `geography`, `order by distance limit 200`. Time: `to_char(starts_at at time zone 'Asia/Kolkata','FMHH12:MI AM')`. Place: `coalesce(nullif(btrim(venue_name),''), venues.name, 'the meeting place')`.
- [ ] **Step 4: Run** the tests → PASS; full `npm test` stays green; `npm run sql:generate && npm run sql:check`.
- [ ] **Step 5: Commit** `feat(db): urgent plans alert nearby players; auto-accept`.

### Task 3: App data layer and notification routing

**Files:**
- Modify: `src/services/mappers.ts` (NeedPost, DbPost, NewPostInput, toDbNewPost, toNeedPost), `src/services/safety.ts`, `src/utils/notificationTarget.ts`, `src/data/mock.ts`
- Test: `tests/coreFlows.test.ts`, new `tests/notificationSettings.test.ts`

**Interfaces:**
- Produces:
  - `NeedPost.urgent?: boolean`, `NeedPost.autoAccept?: boolean`; `NewPostInput.urgent?: boolean`, `NewPostInput.autoAccept?: boolean` (sent as `urgent`/`auto_accept` only when true).
  - `type NotificationCategory = "messages" | "plans" | "bookings" | "nearby"`.
  - `notificationPreferences(): Promise<{ pushEnabled: boolean } & Record<NotificationCategory, boolean> & { alertArea: { label: string } | null }>` (missing keys from older servers → `true` / `null`).
  - `setNotificationCategory(category: NotificationCategory, enabled: boolean): Promise<void>`.
  - `setAlertArea(area: OnboardingArea | null): Promise<void>`.
  - `notificationTarget`: `nearby_plan` → `{ screen: "PostDetails", params: { postId: refId } }` for personal accounts.
- [ ] **Step 1: Write failing tests**: `notificationTarget({kind:"nearby_plan",refId:"p1"},"personal")` deep-equals the PostDetails target; `toDbNewPost` includes `urgent: true, auto_accept: true` only when set and omits them otherwise; demo-mode `notificationPreferences()` returns all categories true and `alertArea` from the demo profile; `setNotificationCategory("nearby", false)` then `notificationPreferences()` shows `nearby: false` (demo mode).
- [ ] **Step 2: Run** `npx tsx --test tests/notificationSettings.test.ts tests/coreFlows.test.ts` → FAIL.
- [ ] **Step 3: Implement** the interfaces above (demo mode keeps state in module memory like `demoPush`).
- [ ] **Step 4: Run** → PASS; `npx tsc --noEmit`.
- [ ] **Step 5: Commit** `feat(app): urgent plan fields, notification categories, nearby alert routing`.

### Task 4: Notification settings screen and sign-up hint

**Files:**
- Modify: `src/screens/settings/SafetyScreens.tsx` (`NotificationSettingsScreen`), `src/screens/onboarding/OnboardingFlow.tsx` (area step copy)
- Test: `tests/notificationSettings.test.ts` (copy constants)

**Interfaces:**
- Consumes: Task 3 services; `OnboardingLocation` (existing) for choosing an area.
- Produces: exported `NOTIFICATION_SWITCHES: { key: NotificationCategory; label: string; hint: string }[]` in `src/utils/notificationSettings.ts` with labels exactly: "Messages", "Plan requests and updates", "Bookings", "Nearby players needed". Sign-up line exactly: "Add your area to hear when nearby players are needed."
- [ ] **Step 1: Write failing test** asserting `NOTIFICATION_SWITCHES.map(s=>s.label)` equals the four labels in that order.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the screen: existing master switch, then one row per switch (disabled while the master is off); the nearby row shows the area label with "Change" (opens `OnboardingLocation` in a sheet, saves with `setAlertArea`) and "Remove", or "Add your area" when none. Business accounts see only Messages and Bookings. Add the sign-up line under the personal area step.
- [ ] **Step 4: Run** tests + `npx tsc --noEmit` → PASS. Web demo screenshot of the settings screen.
- [ ] **Step 5: Commit** `feat(app): choose which notifications you get; nearby alert area`.

### Task 5: Plan editor switches, new-plan link, urgent badge

**Files:**
- Modify: `src/screens/personal/PostEditor.tsx`, `src/screens/personal/CreatePostScreen.tsx`, `src/navigation/types.ts` (`PersonalTabParamList.CreatePost`), `src/hooks/usePlanLinks.ts`, `src/utils/shareLink.ts`, `src/components/PostRow.tsx`, `src/screens/personal/PostDetailsScreen.tsx`
- Test: `tests/shareLink.test.ts`, new `tests/urgentPlan.test.ts`

**Interfaces:**
- Consumes: Task 3 `NewPostInput.urgent/autoAccept`, `NeedPost.urgent`.
- Produces:
  - `newPlanVenueFromLink(url: string | null | undefined): string | null` — accepts `nearry://new-plan?venue=<id>` and `https://…?newplan=<id>`; id must match `/^[A-Za-z0-9_-]{1,64}$/`.
  - `newPlanShareUrl(venueId: string, base?: string): string | null` — null when base missing/not https/bad id.
  - `CreatePost: { venueId?: string; urgent?: boolean } | undefined`.
  - `urgentAllowed(startsAt: Date | null, now?: number): boolean` in `src/utils/urgentPlan.ts` (true iff future and ≤ 6 h).
- [ ] **Step 1: Write failing tests** for both link helpers (valid, wrong scheme, bad id, missing base, `?plan=` not mistaken for `newplan`) and `urgentAllowed` (now+5h59 true, now+6h01 false, past false, null false).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Editor (new plans only): "Players needed now — alert people nearby" switch shown when `urgentAllowed(startsAtDate)`; turns off automatically if the time moves outside 6 h; "Accept people automatically until full" switch. `CreatePostScreen` passes route params to the editor: `venueId` → `getVenue(id)` → `setVenue({ name, venueId })`; start date = today at the next full hour; `urgent` preselected. `usePlanLinks` also handles `newPlanVenueFromLink` → `navigationRef.navigate("PersonalApp",{screen:"PersonalTabs",params:{screen:"CreatePost",params:{venueId,urgent:true}}})` only when the existing `ready` condition holds. "Players needed" badge on `PostRow` and plan details when `post.urgent`.
- [ ] **Step 4: Run** tests + `npx tsc --noEmit` → PASS. Web demo screenshot of the editor with both switches.
- [ ] **Step 5: Commit** `feat(app): players-needed switch, auto-accept and new-plan links`.

### Task 6: Share page, hosting and build config

**Files:**
- Create: `scripts/openPage.ts` (moved page builder: `openPage(play: string): string`)
- Modify: `scripts/export-legal.ts`, `.github/workflows/build-apk.yml`, `eas.json`, `docs/share-links.md`
- Test: new `tests/openPage.test.ts`
- Publish: branch `gh-pages` containing only `open.html` and `.nojekyll`

**Interfaces:**
- Produces: `openPage(play)` HTML whose script handles `?plan=` (unchanged) and `?newplan=` → Android `intent://new-plan?venue=<id>#Intent;scheme=nearry;package=com.nearry.app;S.browser_fallback_url=<play>;end`, others `nearry://new-plan?venue=<id>`; heading "Short of players?" and copy "Post it on Nearry and nearby players get an alert."
- Default share URL: `https://sreerajrajeevan.github.io/nearry/open.html`.
- [ ] **Step 1: Write failing test**: run the page's inline script in `node:vm` with `location.search="?newplan=v1"` and an Android user agent; assert `location.href` becomes the intent URL above with the encoded Play URL; with `?plan=p1` the existing `intent://plan/p1…` behaviour is unchanged; with `?newplan=bad id` no redirect and the Play button stays.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `openPage`, use it from `export-legal.ts`; `build-apk.yml` → `${{ vars.EXPO_PUBLIC_SHARE_URL || 'https://sreerajrajeevan.github.io/nearry/open.html' }}`; add `EXPO_PUBLIC_SHARE_URL` with that value to each `eas.json` build profile's `env`; document the one manual step (Settings → Pages → Deploy from branch → `gh-pages`).
- [ ] **Step 4: Run** test → PASS. Generate `open.html` (`openPage` via `tsx`), push `gh-pages` (orphan branch: `open.html`, `.nojekyll`).
- [ ] **Step 5: Commit** `feat: share page opens a new plan or the Play Store; default share URL`.

### Task 7: Business "Players short?" QR card

**Files:**
- Create: `src/screens/business/PlayersCardScreen.tsx`, `src/components/QrCode.tsx`
- Modify: `src/navigation/BusinessStack.tsx`, `src/navigation/types.ts` (`BusinessStackParamList.PlayersCard: undefined`), `src/screens/business/BusinessProfileScreen.tsx`, `package.json` (`qrcode-generator`)
- Test: new `tests/qrCode.test.ts`

**Interfaces:**
- Consumes: Task 5 `newPlanShareUrl`; existing `getMyBusinessVenue()`.
- Produces: `qrMatrix(text: string): boolean[][]` in `src/utils/qrMatrix.ts` (error correction "M"); `<QrCode value size />` draws the matrix with `View`s plus a 4-module white margin.
- [ ] **Step 1: Write failing test**: `qrMatrix("https://x.test/open.html?newplan=v1")` is square, size ≥ 21, size ≡ 1 (mod 4), and the three finder patterns are present (top-left 7×7 border dark, centre 3×3 dark).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Screen: verified venue → card with venue name, "Short of players?", "Scan to post it on Nearry. Nearby players get an alert.", the QR, and Share (system share of the link + text). No verified venue → "Verify your venue to get your card". No share URL in the build → "Your card isn't set up yet" (no QR). Entry row "Players-short QR card" on the Business tab.
- [ ] **Step 4: Run** test + `npx tsc --noEmit` → PASS. Web demo screenshot of the card.
- [ ] **Step 5: Commit** `feat(business): players-short QR card`.

### Task 8: Privacy wording, docs, full verification, PR

**Files:**
- Modify: `src/utils/legal.ts` (privacy location paragraph), `docs/play-data-safety.md`, `supabase/migrations/README.md`
- Test: existing `tests/legalExport.test.ts`, `tests/terms.test.ts`

- [ ] **Step 1:** Privacy: the area chosen at sign-up or in settings is kept until removed or the account is deleted; GPS areas are rounded to about 1 km; used to show nearby plans and send "players needed" alerts. Data safety doc: approximate location retained until removed. Migration README entry for `00050` (rollout: apply after the matching app build; older builds unaffected).
- [ ] **Step 2: Run** `npm test`, `npx tsc --noEmit`, `npm run sql:check`, `npx prettier --check` on changed files → all pass.
- [ ] **Step 3:** Push branch `feat/players-needed`, open PR with what changes, rollout (apply `00050`, enable Pages, new build), and checks.
