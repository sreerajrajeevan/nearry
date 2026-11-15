// Public build switches; no passwords or server credentials belong here.
export const emailOtpEnabled =
  process.env.EXPO_PUBLIC_EMAIL_OTP_ENABLED !== "false";
export const reviewerLoginEnabled =
  process.env.EXPO_PUBLIC_REVIEWER_LOGIN_ENABLED === "true";

export const REVIEWER_EMAILS = [
  "nearry.play.personal@example.invalid",
  "nearry.play.business@example.invalid",
] as const;

export function isReviewerEmail(email: string): boolean {
  return REVIEWER_EMAILS.some(
    (allowed) => allowed === email.trim().toLowerCase(),
  );
}
