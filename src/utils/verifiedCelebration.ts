/** Remembers which approval the person has already celebrated on this phone. */
export const verifiedSeenKey = (userId: string) =>
  `nearry.verifiedSeen.${userId}`;

const RECENT_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Play the "you're verified" moment when the person taps the approval
 * notification, or the first time they open their profile after a recent
 * approval. A removed and repeated check has a new review time, so it plays again.
 */
export function shouldCelebrateVerified({
  verified,
  reviewedAt,
  seen,
  fromNotification,
  now = Date.now(),
}: {
  verified: boolean;
  reviewedAt?: string;
  seen?: string | null;
  fromNotification?: boolean;
  now?: number;
}): boolean {
  if (!verified) return false;
  if (fromNotification) return true;
  if (!reviewedAt || seen === reviewedAt) return false;
  const at = Date.parse(reviewedAt);
  return Number.isFinite(at) && now - at < RECENT_MS;
}
