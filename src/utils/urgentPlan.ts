/** "Players needed now" alerts are for plans starting in the next 6 hours. */
export const URGENT_WINDOW_MS = 6 * 60 * 60 * 1000;

export function urgentAllowed(
  startsAt: Date | null,
  now = Date.now(),
): boolean {
  if (!startsAt) return false;
  const lead = startsAt.getTime() - now;
  return lead > 0 && lead <= URGENT_WINDOW_MS;
}
