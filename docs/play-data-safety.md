# Data safety draft — verify before submitting

This inventory describes the reviewed source, not completed Play Console answers.
The operator must confirm the deployed providers, retention, permissions and
release APK/AAB before submitting. Service-provider processing is not automatically
“sharing” under Google's definitions; assess each applicable exception and the
provider's actual terms. Public posts/photos and intentional sharing also need
that assessment. Do not simply answer “No data collected” or “No data shared”.

| Candidate Play data type | Nearry use | Required/optional and purpose |
| --- | --- | --- |
| Name, email address, user IDs | Auth account, display name, role and owner IDs | Account identity is required for real use; account management, app functionality and security |
| Other personal information | Bio, interests, gender, self-declared age and business/verification details | Name, gender and age are required before creating or joining plans; business review is required for business publishing; functionality and abuse prevention |
| Approximate/precise location | Optional foreground coordinates and chosen activity/venue area; place-search requests to Google Maps Platform (Geoapify only when configured as fallback) | GPS is optional; manual area selection is available; app functionality. Verify provider/log retention before claiming ephemeral processing |
| Photos | Chosen profile, post and venue photos; private business-verification images and optional camera selfies for human profile review | Optional uploads, with business proof required for review; functionality and fraud prevention. Public photos are publicly accessible |
| Other in-app messages | Conversation messages and messages submitted in reports | Used when messaging/reporting; app functionality and safety. This is not SMS or email inbox access |
| Other user-generated content | Posts, offers, reports, business details and associated content | Used when creating content or submitting reports; functionality and safety |
| App interactions / other actions | Join requests, bookings, blocks, notification preferences and read states | Collected when those features are used; functionality and abuse prevention |
| Crash logs / Diagnostics (App info and performance) | Sentry crash reports when EXPO_PUBLIC_SENTRY_DSN is set: error, stack, app version, device model/OS, recent screen names. No user ID, IP, typed text, messages or location; emails/phone numbers/coordinates masked on device | Collected automatically on crashes; analytics of app stability. Not linked to the user's identity. Set Sentry data retention to 90 days to match the policy |
| Purchase history (Financial info) | Nearry Premium subscription purchases made through Google Play; RevenueCat receives the Nearry account id and purchase history to manage the subscription. No card or bank details reach Nearry | Collected when a user subscribes; linked to the account; used for app functionality; shared with RevenueCat as a service provider (not for advertising) |
| Device or other IDs | Expo/FCM push registration token associated with an account | Optional notifications; functionality. This is not an advertising identifier |

Check whether bookings/reservations with prices fall under **Purchase history**
for the actual offering. The absence of an in-app payment SDK alone does not
settle that answer. There is no payment-card, bank-account, phone-number,
contacts, microphone, background-location, advertising or cross-app
tracking feature in the reviewed code. Recheck the final dependency manifest.
Provider operational logs may involve diagnostics and additional metadata;
confirm their actual collection/retention rather than declaring them absent.

## Security and deletion answers

- Backend endpoints are HTTPS; sessions and database permissions restrict private
  data. Chat is **not end-to-end encrypted**. Public image URLs are public.
- The app has an authenticated account-deletion request, but permanent cleanup
  depends on the deployed maintenance worker and its schedule. Do not attest to
  successful cleanup until a controlled end-to-end deletion has passed.
- Provide both the in-app deletion path and the hosted `delete-account.html` URL.
  It describes an email request route for users without the app; that mailbox
  must be monitored and ownership verified without asking for an OTP/password.
- The policy's resolved-report and push-receipt retention periods depend on the
  maintenance schedule. Confirm provider logs/backups and restoration handling.
- No independent security certification or audit badge has been established.

## Providers to verify

Supabase (Auth/database/storage/server functions), Sentry (crash reports), RevenueCat (subscriptions), Resend (auth and review mail),
Geoapify (place search), Expo and Google/Apple push services, and Google OAuth.
Firebase Analytics was not enabled during the recorded Firebase setup. Check the
actual release configuration again before claiming analytics collection is absent.

References: [Data safety form](https://support.google.com/googleplay/android-developer/answer/10787469),
[User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311),
[account deletion](https://support.google.com/googleplay/android-developer/answer/13327111).

The optional selfie feature uses CAMERA with explicit consent and a private upload. It uses a server-issued pose and human review, not automated face templates or proof of identity/age/liveness. Include selfie collection and retention in the final Data safety assessment. The play-test profile uses Google sign-in for testers; email OTP is disabled until the sender domain is verified. Provisioned reviewer accounts use standard password authentication and normal database permissions.
