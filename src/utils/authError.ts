export function friendlyAuthError(message: string, code?: string): string {
  const m = message.toLowerCase();
  if (
    code === "email_address_not_authorized" ||
    m.includes("email address not authorized")
  )
    return "Email sign-in is not available for this address yet. Nearry's email delivery needs to be configured. Try Google sign-in for now.";
  if (code === "over_email_send_rate_limit" || m.includes("email rate limit"))
    return "Nearry's email sending limit has been reached. Try again later or continue with Google.";
  if (code === "email_provider_disabled")
    return "Email sign-in is currently unavailable. Try Google sign-in for now.";
  if (code === "over_request_rate_limit")
    return "Too many attempts — wait a minute and try again.";
  if (code === "otp_expired")
    return "That code is incorrect or expired. Request a new one.";
  if (m.includes("invalid") && m.includes("otp"))
    return "That code is incorrect or expired.";
  if (m.includes("expired"))
    return "That code has expired — request a new one.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts — wait a minute and try again.";
  if (m.includes("provider") && m.includes("not enabled"))
    return "Google sign-in is not enabled yet.";
  if (m.includes("signup") && m.includes("not allowed"))
    return "No account found for this email. If you're new, create an account below.";
  return message;
}
