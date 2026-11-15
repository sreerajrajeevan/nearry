# Play test release — 16 November 2026

The `play-test` EAS profile builds a store-distribution AAB using the existing private upload key via ignored local credentials. It explicitly disables general email OTP and enables password sign-in for the two provisioned review accounts. Regular testers use Google. The normal production profile keeps its existing authentication settings; a verified sender domain is still required before enabling general email codes for the public release.

## Hosted pages

- Support: https://nearry-support.dark-wasp-5372.chatgpt.site/
- Privacy: https://nearry-support.dark-wasp-5372.chatgpt.site/privacy.html
- Account deletion: https://nearry-support.dark-wasp-5372.chatgpt.site/delete-account.html
- Child safety: https://nearry-support.dark-wasp-5372.chatgpt.site/child-safety.html
- Terms: https://nearry-support.dark-wasp-5372.chatgpt.site/terms.html

Public operator label: Nearry. Support/privacy contact: nearrysupport@gmail.com. The account owner must monitor this mailbox and the admin reporting/review queues. Policy publication does not itself operate a moderation service.

## App access

On either account lane's sign-in page, choose **App review access** and enter the separately supplied review email and password. These accounts use normal Supabase authentication and database permissions, have preconfigured profiles, and have no admin privileges. The Business review account is preverified with a clearly labelled sample venue. Passwords are kept in private local release instructions and must be supplied only through Play Console App access, never in Git, app source, issues or a public PR. Login-disabled home-sample accounts are not review credentials.

## Build and test

Run `npm run release:check`, `npm run typecheck`, `npm run sql:check`, `npm test`, and export Android/web. Provision the Firebase Android client file and EAS project settings. Then build with `eas build --platform android --profile play-test`. The shared debug key and debug APK are not store upload credentials/artifacts. Do not generate a replacement key when an existing private upload key is present.

Upload the signed AAB through Play Console Internal testing first. Install from Play, then test Google sign-in on both lanes, role retention/onboarding, reviewer access, cover selection/crop/edit, venue search, nearby/calendar filters, requests/approvals/leaving/vacancy counts/group chat, bookings, reports/blocks/deletion and push notification delivery/taps with the app closed. Check keyboard and safe areas on multiple phones. Static native alignment checks do not replace a 16 KB device/emulator check.

Complete the listing, content rating, audience, ads, Data safety, App access and child-safety declarations based on actual operation. If the personal developer account is subject to Google's production-access rule, use a closed track with at least 12 continuously opted-in testers for 14 days before applying for public release; internal testing alone does not satisfy that requirement.

Keep the labelled home samples during testing, then remove or isolate their exact campaign before public launch. Do not mass-delete real tester accounts or admin access.

## Backend repair

The push worker now has a matching dispatch secret in secure function configuration and Vault. Its scheduler invokes an internal definer function with no public/anonymous/authenticated execute privilege. The worker accepted an authenticated request with HTTP 200 and zero failures, and subsequent scheduled requests succeeded. No devices were registered during repair, so this proves worker scheduling/authentication, not phone delivery. No real notification was delivered to a device in that check.

Automatic account maintenance and expiry schedules were already active. No existing real accounts or posts were deleted for this release preparation.
