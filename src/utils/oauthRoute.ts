/** Only the app's explicitly supported callback path may normalize its slash form. */
export function sameOAuthRoute(actual: string, expected: string): boolean {
  try {
    const a = new URL(actual),
      b = new URL(expected);
    if (
      a.protocol !== b.protocol ||
      a.username ||
      a.password ||
      a.port !== b.port
    )
      return false;
    if (a.protocol !== "nearry:")
      return a.origin === b.origin && a.pathname === b.pathname;
    const path = (u: URL) =>
      `${u.hostname}/${u.pathname}`.replace(/^\/+/, "").replace(/\/+/g, "/");
    return path(a) === "auth/callback" && path(b) === "auth/callback";
  } catch {
    return false;
  }
}
