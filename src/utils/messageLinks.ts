/**
 * Find web links in a chat message so they can be tapped. Matches http(s)://
 * links and bare www. / wa.me links; trailing punctuation stays as text.
 */
export type MessagePart = { text: string; url?: string };

const LINK = /\b(?:https?:\/\/|www\.|wa\.me\/)[^\s<>"]+/gi;
const TRAILING = /[.,;:!?'")\]}]+$/;

export function messageParts(body: string): MessagePart[] {
  const parts: MessagePart[] = [];
  let last = 0;
  for (const match of body.matchAll(LINK)) {
    let raw = match[0];
    const start = match.index ?? 0;
    // Keep a closing bracket that belongs to the link, e.g. ...wiki/Foo_(bar)
    let trail = raw.match(TRAILING)?.[0] ?? "";
    if (trail.startsWith(")") && raw.includes("(")) trail = trail.slice(1);
    if (trail) raw = raw.slice(0, raw.length - trail.length);
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    if (!isSafeUrl(url)) continue;
    if (start > last) parts.push({ text: body.slice(last, start) });
    parts.push({ text: raw, url });
    last = start + raw.length;
  }
  if (last < body.length) parts.push({ text: body.slice(last) });
  return parts.length ? parts : [{ text: body }];
}

/** Only real web addresses with a host; never javascript:, file:, etc. */
export function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      (u.protocol === "https:" || u.protocol === "http:") &&
      /\.[a-z]{2,}$/i.test(u.hostname)
    );
  } catch {
    return false;
  }
}
