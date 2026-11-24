export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.nearry.app";
const PLAN_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * The link put in a shared plan. With EXPO_PUBLIC_SHARE_URL set to the hosted
 * open.html page, the link opens that exact plan in the app (or the Play
 * Store when the app isn't installed). Without it, the Play Store listing.
 */
export function planShareUrl(
  postId: string,
  base = process.env.EXPO_PUBLIC_SHARE_URL?.trim(),
): string {
  if (!base || !/^https:\/\//.test(base) || !PLAN_ID.test(postId))
    return PLAY_STORE_URL;
  return `${base}${base.includes("?") ? "&" : "?"}plan=${encodeURIComponent(postId)}`;
}

export function planShareMessage(
  plan: { id: string; title: string; when: string; where?: string },
  base?: string,
): string {
  return [
    `Join me on Nearry: ${plan.title}`,
    [plan.when, plan.where].filter(Boolean).join(" · "),
    planShareUrl(plan.id, base),
  ]
    .filter(Boolean)
    .join("\n");
}

/** The plan id in nearry://plan/<id> or https://…open.html?plan=<id>. */
export function planIdFromLink(url: string | null | undefined): string | null {
  if (!url) return null;
  const app = /^nearry:\/\/plan\/([^/?#]+)/i.exec(url);
  let id: string | undefined;
  try {
    id = app
      ? decodeURIComponent(app[1])
      : /^https:\/\/[^?#]+[?&]plan=([^&#]+)/i.exec(url)?.[1];
  } catch {
    return null;
  }
  return id && PLAN_ID.test(id) ? id : null;
}

/**
 * The link a venue shares (or prints as a QR) so a host short of players can
 * start a plan there: https://…open.html?newplan=<venue id>. Null when the
 * build has no https share page or the id isn't clean.
 */
export function newPlanShareUrl(
  venueId: string,
  base = process.env.EXPO_PUBLIC_SHARE_URL?.trim(),
): string | null {
  if (!base || !/^https:\/\//.test(base) || !PLAN_ID.test(venueId)) return null;
  return `${base}${base.includes("?") ? "&" : "?"}newplan=${encodeURIComponent(venueId)}`;
}

/** The venue id in nearry://new-plan?venue=<id> or https://…?newplan=<id>. */
export function newPlanVenueFromLink(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  const match =
    /^nearry:\/\/new-plan\?(?:[^#]*&)?venue=([^&#]+)/i.exec(url) ??
    /^https:\/\/[^?#]+\?(?:[^#]*&)?newplan=([^&#]+)/i.exec(url);
  if (!match) return null;
  let id: string;
  try {
    id = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  return PLAN_ID.test(id) ? id : null;
}
