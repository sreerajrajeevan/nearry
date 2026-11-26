# Around you: design

**Why:** sometimes you'd like to meet someone who is in the same place right now, at a mall, a café or a gym, but you're too shy to walk up to them. With "Around you", people who have chosen to be visible can find each other over Bluetooth and send a polite invite ("Coffee now?"). It is a small extra inside Nearry, not a dating app: Nearry stays a plans app.

## How it works for people

- **Open to meet.** A switch on Discover and in Profile: "Open to meet for the next hour". You pick what you're up for (coffee, food, a walk, gym, shopping, a game) and who can invite you (everyone, women only or men only). It turns itself off after 1 hour, or when you switch it off. While it is on, a small banner says you're visible.
- **Around you list.** Only while your own switch is on, a list shows other people nearby who are also Open to meet: first name, a verified tick if they have one, and what they're up for. No photo, no distance, no direction, no "last seen". Someone drops off the list about 2 minutes after their phone is out of Bluetooth range.
- **Invite.** Tap a person and send an invite: pick one of their activities and add an optional note of up to 80 characters. They get a notification. They see your first name, your photo and your note.
  - **Accept:** a one-to-one chat opens for both of you, and now you both see each other's photo. This reuses the existing chats.
  - **Decline, or no reply within 1 hour:** the invite closes. You both stop seeing each other in Around you for good. The sender is told only "No reply this time".
- **Limits.** 5 invites a day. One invite per pair of people, ever. Blocks and reports work here as everywhere else. Blocked people never see each other.
- **Who can use it.** Personal accounts that finished onboarding, have a profile photo and confirm "I'm 18 or older" the first time they switch it on.

## How it works under the hood

- **Bluetooth, Android first.** The phone broadcasts a random code over Bluetooth Low Energy and listens for other Nearry codes. The code never contains your name or ID, and it changes every 10 minutes, so a Bluetooth scanner can't follow anyone. Only the Nearry server can turn a code into a profile, and only for someone whose switch is on too. Bluetooth runs only while the switch is on and the app is open.
- **Native code.** Expo has no Bluetooth broadcasting, so we add a small native Android module in the repo (`modules/nearby-ble`). It needs a development or release build (EAS); it won't run in Expo Go. Android asks for the "Nearby devices" permission (Android 12+); older Android also needs location permission for Bluetooth scans.
- **iPhone later.** iOS only allows broadcasting with the app open, and differently from Android. We add it as a second step once Android works.
- **Database.** New tables for meet sessions (switch on/off, activities, who can invite, expiry), the current code per session, invites, and hidden pairs. Phones send the codes they heard to one function, which returns only people who are visible, not blocked, allowed by both sides' "who can invite" settings and not hidden. Invites, accept and decline go through database functions that enforce the limits.
- **Hidden at launch.** The feature only appears in builds with `EXPO_PUBLIC_AROUND_YOU=1`, so you can test it with friends using a test APK before anyone else sees it.

## Decisions

- Bluetooth instead of phone location, because location is unreliable indoors in malls (the user's choice).
- It sits inside Nearry as a small extra, framed around activities ("coffee now?"), not dating (the user's choice).
- No photo in the list, only after an accepted invite. Photos would let anyone match a profile to a stranger in the room, including someone who said no.
- 18+ is a self-confirmation for now. A selfie check is a separate, later feature.

## Non-goals

No map, distance or direction. No browsing people when your own switch is off. No background Bluetooth while the app is closed. No group invites. No iPhone in the first version.
