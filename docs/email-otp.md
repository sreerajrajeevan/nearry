# Email codes not arriving

Email authentication is sent by Supabase Auth, independently of Firebase push
notifications. Changing the Android Firebase file will not fix email delivery.

## Check the live project

1. In the Supabase project used by the installed app, open Authentication's logs.
   Reproduce one Send code request and inspect its `/otp` event. Check the email
   provider's delivery log too, if custom SMTP is already configured. Avoid
   repeatedly resending: requests have a cooldown and a separate sending quota.
2. Under Authentication → Sign In / Providers, confirm Email is enabled.
3. Under Authentication → Emails → SMTP Settings, check the sender. Supabase's
   default email service is restricted to organization team addresses and has a
   very low project-wide sending quota. Real users require a configured SMTP
   service, with its verified sender/domain and host, port, username and password.
   Store SMTP credentials only in Supabase, never in the app or GitHub source.
4. Under Emails → Templates, include `{{ .Token }}` in both **Magic Link**
   (returning users) and **Confirm signup** (new users). Nearry accepts the full
   numeric code with Supabase's supported length of 6–10 digits; do not shorten
   server-generated codes to fit an older app. Do not disable email confirmation
   to work around a delivery problem.
5. Log in does not create accounts. Someone without a Nearry account must use
   Create an account first. Supabase may deliberately hide account existence;
   the app cannot infer mailbox delivery from an accepted request.

For Resend SMTP, its `resend.dev` test sender can only send to the Resend account
owner. A verified sending domain and a From address on that domain are required
to email other recipients. A working SMTP connection or valid API key alone does
not remove that restriction. See [Resend's test-domain restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

## Verify the result

Use a mailbox you control. Test a new Personal signup and Business signup, then
sign out and log in again. Confirm delivery of the numeric code, verification,
correct account routing and session restoration after restarting the app. Check
spam, and confirm the mail provider reports delivery rather than only acceptance.
Only the newest valid code should be used after a resend.

SMTP/template dashboard changes do not require an APK rebuild. App changes,
including the resend countdown and clearer delivery errors, do require a new
build. The automated tests use a fake HTTP boundary and do not verify delivery
to a real inbox.

References: [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp),
[email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless),
[Auth errors](https://supabase.com/docs/guides/auth/debugging/error-codes).
