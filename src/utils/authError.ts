export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
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
