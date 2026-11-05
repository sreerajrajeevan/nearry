# Nearry store listing draft

Review this copy against the signed release build before publishing. Do not claim
that live email, booking, chat, business review or push delivery was verified just
because its code is present.

## App name

Nearry

## Short description

Find nearby plans, meet people and explore places around you.

## Full description

A good plan starts nearby.

Nearry helps you discover things to do, find people to join your plans and explore
places in your neighbourhood.

LOOK AROUND
Search places and browse nearby plans. Choose an area yourself or use optional
location access to find what is around you.

MAKE A PLAN
Create a plan, add a photo and share when and where you want to meet. Set the
number of available spots, manage requests and keep participants in the loop.

FIND YOUR PEOPLE
Discover games, casual meetups and other activities. Request a spot, follow your
plans in Activity and talk with people through the conversations available in
the app.

FOR LOCAL BUSINESSES
Create a Business account, submit your business for review, publish offers and
manage bookings and messages. Business publishing requires approval.

STAY IN CONTROL
Manage your own posts, report concerning content, block unwanted contact and
choose your notification preferences. Account deletion is available in the app.

Nearry is for adults aged 18 and over. Location access is optional. Payments are
not processed in Nearry; confirm any price and arrangement directly with the
host or business.

## Graphics and screenshots

Run `python3 assets/generate_store.py` with Pillow to generate:

- `dist-store/play-icon.png`: 512 × 512, opaque PNG.
- `dist-store/feature-graphic.png`: 1024 × 500, opaque PNG.

Capture at least two genuine phone screenshots from the signed release build.
Suggested sequence: Nearby, Search, a post with its details, Activity and Profile.
Use accounts and photos you have permission to publish. Hide email addresses,
private conversations, documents and notifications. Screenshots should show
working features; demo data must not be passed off as real local availability.
Do not use an imaginary mockup as evidence of a shipped screen.

## Fields the owner must complete

- Developer/legal operator and monitored support address.
- Public privacy, account-deletion and child-safety standards URLs.
- App category/tags and distribution countries. Social is a reasonable candidate
  based on the community features; confirm the category in Play Console.
- Ads declaration: the reviewed code has no advertising SDK or in-app ads.
- Target audience: current signup and terms are for ages 18 and over.
- Content-rating answers based on actual user-generated content and chat.
- Child-safety contact and an operational process for reviewing reports and
  escalation to the relevant authority.
- App access: provide review instructions and reliable access to all restricted
  features. A short-lived OTP pasted in the form is not reusable reviewer access;
  a sample-data demo alone does not demonstrate real joins, bookings or chat.

The developer must verify and submit declarations. Do not invent identity,
ratings, security certifications or device-test results.

References: [listing assets](https://support.google.com/googleplay/android-developer/answer/9866151),
[app content and review access](https://support.google.com/googleplay/android-developer/answer/9859455),
[child safety](https://support.google.com/googleplay/android-developer/answer/14747720).
