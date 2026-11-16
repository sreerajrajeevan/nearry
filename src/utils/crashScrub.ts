/**
 * Crash reports must not carry personal data. These run on every report and
 * breadcrumb before it leaves the phone: no user, request bodies, headers,
 * typed text or tap labels, and anything that looks like an email, phone
 * number, token or coordinate is masked.
 */
type Crumb = {
  category?: string;
  message?: string;
  data?: Record<string, unknown>;
};
type CrashEvent = {
  user?: unknown;
  request?: unknown;
  message?: string;
  exception?: { values?: { value?: string }[] };
  breadcrumbs?: Crumb[];
  extra?: unknown;
};

const PATTERNS: [RegExp, string][] = [
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[token]"],
  [/\b(?:bearer|apikey|token)[=: ]+[A-Za-z0-9._-]{8,}/gi, "[token]"],
  [/-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}/g, "[coords]"],
  [/\+?\d[\d\s-]{8,}\d/g, "[number]"],
];

export function maskText(text: string): string {
  return PATTERNS.reduce((out, [re, label]) => out.replace(re, label), text);
}

/** Taps and console lines can contain names and messages: drop them. */
const DROPPED = new Set(["touch", "console", "ui.click", "ui.input"]);

export function scrubBreadcrumb<T extends Crumb>(crumb: T): T | null {
  if (crumb.category && DROPPED.has(crumb.category)) return null;
  const next = { ...crumb };
  if (next.message) next.message = maskText(next.message);
  if (next.data) {
    const data: Record<string, unknown> = {};
    // Keep only harmless fields; URLs lose their query (search text, ids).
    if (typeof next.data.url === "string")
      data.url = maskText(next.data.url.split("?")[0]);
    for (const key of ["method", "status_code", "from", "to"])
      if (next.data[key] !== undefined) data[key] = next.data[key];
    next.data = data;
  }
  return next;
}

export function scrubEvent<T extends CrashEvent>(event: T): T {
  const next = { ...event };
  delete next.user;
  delete next.request;
  delete next.extra;
  if (next.message) next.message = maskText(next.message);
  if (next.exception?.values)
    next.exception = {
      ...next.exception,
      values: next.exception.values.map((v) => ({
        ...v,
        ...(v.value ? { value: maskText(v.value) } : {}),
      })),
    };
  if (next.breadcrumbs)
    next.breadcrumbs = next.breadcrumbs
      .map((b) => scrubBreadcrumb(b))
      .filter((b): b is Crumb => !!b);
  return next;
}
