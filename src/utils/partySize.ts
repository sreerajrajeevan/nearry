/** Most people one booking can cover (also enforced by the database). */
export const MAX_PARTY_SIZE = 4;

/** The most people the + button allows: 4, or fewer if the slot has fewer places. */
export function partyLimit(seatsLeft: number | undefined): number {
  return Math.max(1, Math.min(MAX_PARTY_SIZE, seatsLeft ?? MAX_PARTY_SIZE));
}

/** Why + has stopped, shown once the person reaches the limit. */
export function partyLimitNote(
  partySize: number,
  seatsLeft: number | undefined,
): string | null {
  const limit = partyLimit(seatsLeft);
  if (partySize < limit) return null;
  if (limit === MAX_PARTY_SIZE)
    return `${MAX_PARTY_SIZE} people is the most for one booking.`;
  return `Only ${limit} ${limit === 1 ? "place" : "places"} left in this slot.`;
}
