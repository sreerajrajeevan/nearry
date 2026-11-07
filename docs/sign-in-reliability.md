# Sign-in reliability and Google branding

## App behavior

- Google requests account selection with basic Supabase Google sign-in. It no
  longer forces `prompt=consent` on every login or asks for offline Google access.
  Supabase session refresh still works independently of Google's provider token.
  Google may still ask for first-time consent or consent after a policy change.
- Errors appear beside the email/code action, including sender failures and
  invalid codes. Only the active action shows progress; duplicate taps are locked.
- Resend cooldowns are keyed by normalized recipient. Correcting an email does
  not inherit a different address's cooldown; returning to an address retains it.
- Pasted/spaced codes and decimal digits from common native keyboards normalize
  to ASCII while preserving leading zeroes and the supported 6–10 digit length.
- Sign-in and profile-loading HTTP requests have a 20-second deadline, including
  their response body, with cancellation passed to fetch. A timeout releases the
  button; it does not prove the server never accepted a send. Check the inbox
  before requesting another code and use the latest code. Storage uploads and
  unrelated API operations retain their existing transport.
- Login does not create accounts. Supabase can return a deliberately generic
  success for unknown addresses; the code screen offers Create an account.

## Live investigation, 7 November 2026

The sender was `onboarding@resend.dev` through `smtp.resend.com`. This is Resend's
restricted test sender, not general email delivery. The owner confirmed no domain
is available yet. A code request can work for the Resend account owner and fail
for other people regardless of their phone model. **This remains a release
blocker for general email login.** Do not bypass it by auto-confirming users or
claiming a requested email has reached the inbox.

Email confirmation was off; it is now enabled. Both signup and returning-user
email bodies contain `{{ .Token }}`. The returning-user subject was corrected to
**Your Nearry sign-in code**. Enabling confirmation strengthens the signup flow;
it does not remove Resend's recipient restriction. No real OTP emails were sent
as an automated test.

To enable delivery, verify an owned sending domain in Resend, set the Supabase
sender to an address on that verified domain, retain confirmation, then test
mailboxes you control using the provider's delivery logs. Do not commit SMTP
passwords or sender API keys. See [the email checklist](email-otp.md).

## Google-controlled screen

The Supabase project hostname on Google's screen comes from the upstream OAuth
configuration. Changing an Expo app title cannot change that page. Google says
an app name/logo is shown publicly after brand verification. Configure accurate
Nearry branding, support contact and public home/privacy pages under a verified
domain you control, then complete Google's brand-verification process. A
Supabase custom auth domain is another option; it has separate hosting/plan/DNS
requirements and is not enabled by this change.

Google Cloud Branding failed to load in the connected browser during this
investigation, so no Google brand approval or domain change is claimed. The app
change reduces repeated consent prompts for returning users; the first-time
screen can still show the Supabase hostname until upstream branding is verified.

References: [Google branding](https://support.google.com/cloud/answer/15549049),
[Google brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification),
[Supabase Google setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google),
[Resend test sender restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

## Phone check

Install the new build; existing binaries do not receive these code changes.
Test Personal and Business email login/signup, an 8-digit code with a leading
zero, resend, corrected address, Google cancel/retry, slow/offline connection and
keyboard-open button taps. Confirm routing and a restart after login. Automated
fixtures do not prove real mailbox delivery or behavior on every OEM keyboard.
