/** Plan chat refreshes reload this many of the newest messages. */
export function refreshWindow(loaded: number): number {
  return Math.min(500, Math.max(60, loaded));
}

/**
 * Merge a refresh into what's on screen. The refreshed window is
 * authoritative (removed or blocked messages drop out of it); older pages the
 * person already loaded with "Load earlier" stay. When the refresh came back
 * short of `windowSize`, it is the whole chat.
 */
export function mergeRefreshed<T extends { id: string; seq: number }>(
  current: T[],
  fresh: T[],
  windowSize: number,
): T[] {
  if (fresh.length < windowSize || !fresh.length) return fresh;
  const oldestFresh = fresh[0].seq;
  const older = current.filter((m) => m.seq < oldestFresh);
  const seen = new Set(fresh.map((m) => m.id));
  return [...older.filter((m) => !seen.has(m.id)), ...fresh];
}
