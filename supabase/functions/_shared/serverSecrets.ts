/**
 * Server-worker bootstrap guard. A missing or guessable dispatch/HMAC secret
 * must not turn a privileged worker into an unauthenticated API.
 * This helper is intentionally NOT bundled into the mobile application.
 */
export function validServerSecret(value: string | undefined | null): boolean {
 return typeof value==="string" &&
  new TextEncoder().encode(value).length>=32 &&
  value.trim()===value &&
  !/(?:^|[_-])(test|example|placeholder|changeme)(?:$|[_-])/i.test(value);
}
