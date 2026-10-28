# Signup agreement and push setup

Personal and Business signup share one initially unchecked checkbox: “I’m 18 or
older and agree to the Terms & Community Guidelines.” Terms and Privacy Policy
are independent links to the existing legal screens. Privacy is a notice/link,
not a separate consent checkbox. Both email signup and Google signup stay disabled
until agreement; the email keyboard-submit handler has the same guard. Ordinary
login has no checkbox or startup agreement page.

After a checked email signup, OTP verification records acceptance only for the
matching authenticated email. Checked Google signup preserves its short-lived
intent across a browser OAuth redirect, then records it for the authenticated
account. The existing accept_community_terms RPC stores policy version 2026-10-19
and a server timestamp in the profile. It is never invoked just by restoring a
saved session. Failed writes are not marked successful; expired/mismatched policy
intents are ignored and new login/sign-out clears pending signup state. Concurrent
callbacks share the same in-flight acceptance write.

Google can create a new account from Login. Such an account confirms agreement on
its existing onboarding finish step. The same fallback handles an interrupted
signup or failed agreement write. Onboarding does not complete until the existing
RPC succeeds. A successful signup acceptance does not ask again on onboarding.
Returning completed accounts retain access; this change does not retroactively
assign acceptance to them or add a startup gate. Existing accounts that need new
policy acceptance before contributing content require a separate in-context flow.
The obsolete full-screen CommunityConsentScreen implementation is removed.

Native push setup checks the active/onboarded account rather than terms_version.
Suspended/deleting accounts remain excluded. Device permission, project/FCM
credentials and notification preferences continue to control actual delivery.

## Deployment and checks

No new migration is introduced. The deployed backend must already include
00024_account_safety.sql and its accept_community_terms RPC. Keep the policy version
in that RPC and src/utils/legal.ts aligned. Public operator/support details and
policy text still need review before a store release.

Unit checks cover unchecked signup, matching email, Google redirect persistence,
login clearing, expiry/version/malformed data, duplicate callbacks, failed-write
retry and preservation of a newer signup intent. Existing database tests exercise
the authenticated policy RPC. Phone-sized browser checks use an isolated fake API
to exercise Personal/Business email signup, Google signup, first-time Google Login,
returning login without a gate, policy-link return, and a narrow 320px layout.
They do not create real accounts or prove native Google redirects or FCM delivery.
Check those on a rebuilt phone app with disposable staging accounts.
