# Plans around you (Bluetooth)

Hosts can share a plan with people in the same place (a mall, café or gym),
and anyone can tap **Look around** on Discover to see plans shared nearby.
People see plans, never a list of people, and looking around broadcasts
nothing. Design: `docs/superpowers/specs/2026-11-26-around-you-design.md`.

## Switching it on

The feature only appears in builds made with `EXPO_PUBLIC_AROUND_YOU=1`, on
Android phones with Bluetooth Low Energy. Without the flag, the app shows
nothing and the Android build doesn't ask for any Bluetooth permission.

To make a test APK: GitHub → Actions → **Build Android APK** → Run workflow,
tick **Plans around you**. The APK appears under the `debug-latest` release.
Testing needs two Android phones next to each other, signed in to two
different accounts.

## How it works

- **Sharing.** The host turns on "Show to people right here" when posting a
  plan that starts within 2 hours, or taps "Share right here" on the plan
  page. The database (`start_plan_beacon`, migration 00065) returns one random
  16-character code per 10-minute window, until 30 minutes after the start
  (2 hours at most). The phone broadcasts the current code from a foreground
  service with a "Sharing your plan nearby" notification and a Stop button.
- **Looking around.** The phone listens for about 16 seconds (four 4-second
  rounds) and sends the codes it heard to `resolve_plan_beacons`. That returns
  only open plans still being shared, never the viewer's own, and respects
  blocks and the plan's gender and age settings. Joining is the normal join
  request.
- **Codes.** Broadcast as Bluetooth manufacturer data (test company id
  `0xFFFF`), starting with `NRY`, then the 8-byte code. Codes carry no name or
  ID and change every 10 minutes; only the database can match them to a plan.

## Code

- `modules/nearby-ble`: Android native module (scan, share service).
- `plugins/withNearbyBle.js`: adds the Bluetooth permissions and the service,
  only with the flag.
- `src/services/aroundYou.ts`, `src/utils/aroundYou.ts`: permissions, calls,
  rules. `src/components/AroundYouCard.tsx` (Discover) and
  `src/components/ShareHereCard.tsx` (host's plan page).

## Not yet

iPhone (iOS limits Bluetooth broadcasting), background scanning, showing
people instead of plans.
