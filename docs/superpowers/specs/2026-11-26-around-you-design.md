# Plans around you (Bluetooth): design

**Why:** sometimes you'd like company right where you are, at a mall, a café or a gym, but you're too shy to walk up to someone. Instead of browsing people, Nearry lets you share a *plan* with the people in the same place: "Coffee at the food court, anyone?". People nearby see the plan, not a list of people, and join it the normal way. Nobody can be found just by being in the room.

## How it works for people

- **Share a plan right here.** When posting a plan that starts within the next 2 hours, the host can turn on "Show to people right here". Nearry then shares the plan over Bluetooth until the plan starts plus 30 minutes, for 2 hours at most, or until the host taps Stop. While sharing, Android shows a notification "Sharing your plan nearby" with a Stop button, so the host can put the phone in their pocket.
- **See plans around you.** On Discover, an "Around you" card with a **Look around** button. It listens over Bluetooth for about a minute and lists plans being shared nearby: title, activity, start time, spots left, host's first name. No distance or direction. Looking around never broadcasts anything, so the people looking are invisible.
- **Join.** Tapping a plan opens the normal plan page. Joining sends the usual request: the host approves (or auto-accept is on), and then the plan group chat opens. All existing rules apply: plan gender settings (for example women only), spots, blocks, reports and request limits.

## How it works under the hood

- **Bluetooth, Android first.** The host's phone broadcasts a random code for the plan. The code never contains the plan or person ID and changes every 10 minutes, so a scanner can't follow anyone. Only the Nearry server can turn a code into a plan.
- **Server check.** Phones send the codes they heard to one function. It returns a plan only if it's still open, still being shared, hasn't started more than 30 minutes ago, the viewer isn't blocked either way, and the viewer fits the plan's gender setting. The viewer's own plans aren't returned.
- **Native code.** Expo has no Bluetooth broadcasting, so we add a small Android module in the repo (`modules/nearby-ble`). It needs a release or development build (EAS); it won't run in Expo Go. Android asks for "Nearby devices" (Android 12+); older Android also asks for location for Bluetooth scans.
- **iPhone later.** iPhones can look around with the app open; sharing from an iPhone is more limited. Both come after Android works.
- **Hidden at launch.** Only builds with `EXPO_PUBLIC_AROUND_YOU=1` show it, so you can test with friends on a test APK first.

## Decisions

- Plans only, never a list of people: the user's choice, for safety.
- Bluetooth instead of phone location, because location is unreliable indoors in malls (the user's choice).
- Only the host broadcasts. People looking around stay invisible.
- Sharing is limited to plans starting within 2 hours, and stops automatically.

## Non-goals

No list or map of people, no distance or direction, no background scanning, no invites to a specific person, no iPhone in the first version.
