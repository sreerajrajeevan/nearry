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
| Other personal information | Optional bio, interests, gender and business/verification details | Optional profile fields; business review is required for business publishing; functionality and abuse prevention |
| Approximate/precise location | Optional foreground coordinates and chosen activity/venue area; place-search requests to Geoapify | GPS is optional; manual area selection is available; app functionality. Verify provider/log retention before claiming ephemeral processing |
| Photos | Chosen profile, post and venue photos; private business-verification images | Optional uploads, with business proof required for review; functionality and fraud prevention. Public photos are publicly accessible |
| Other in-app messages | Conversation messages and messages submitted in reports | Used when messaging/reporting; app functionality and safety. This is not SMS or email inbox access |
| Other user-generated content | Posts, offers, reports, business details and associated content | Used when creating content or submitting reports; functionality and safety |
| App interactions / other actions | Join requests, bookings, blocks, notification preferences and read states | Collected when those features are used; functionality and abuse prevention |
| Device or other IDs | Expo/FCM push registration token associated with an account | Optional notifications; functionality. This is not an advertising identifier |

Check whether bookings/reservations with prices fall under **Purchase history**
for the actual offering. The absence of an in-app payment SDK alone does not
settle that answer. There is no payment-card, bank-account, phone-number,
contacts, microphone, camera, background-location, advertising or cross-app
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

Supabase (Auth/database/storage/server functions), Resend (auth and review mail),
Geoapify (place search), Expo and Google/Apple push services, and Google OAuth.
Firebase Analytics was not enabled during the recorded Firebase setup. Check the
actual release configuration again before claiming analytics collection is absent.

References: [Data safety form](https://support.google.com/googleplay/android-developer/answer/10787469),
[User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311),
[account deletion](https://support.google.com/googleplay/android-developer/answer/13327111).
