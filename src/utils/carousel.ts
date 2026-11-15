/** How often the offers carousel moves on by itself. */
export const AUTOPLAY_INTERVAL_MS = 4500;
/** After a touch or swipe, wait this long before moving on again. */
export const AUTOPLAY_RESUME_MS = 6000;

export const nextSlide = (page: number, count: number) =>
  count > 0 ? (page + 1) % count : 0;

/**
 * Autoplay only when there is something to move to, the screen is visible
 * and the app is in front, the person hasn't asked for less motion or uses a
 * screen reader, and they haven't touched the carousel recently.
 */
export function shouldAutoAdvance(s: {
  count: number;
  reduced: boolean;
  screenReader: boolean;
  focused: boolean;
  active: boolean;
  pausedUntil: number;
  now: number;
}) {
  return (
    s.count > 1 &&
    !s.reduced &&
    !s.screenReader &&
    s.focused &&
    s.active &&
    s.now >= s.pausedUntil
  );
}
