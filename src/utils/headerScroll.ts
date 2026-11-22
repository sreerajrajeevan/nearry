export type HeaderScrollState = {
  lastY: number;
  travel: number;
  shown: boolean;
};
/** Accumulate small movements in one direction; a single fast frame is not required. */
export function headerScrollState(
  state: HeaderScrollState,
  offset: number,
  height: number,
): HeaderScrollState {
  const y = Math.max(0, Number.isFinite(offset) ? offset : state.lastY),
    delta = y - state.lastY;
  let travel =
    delta === 0
      ? state.travel
      : Math.sign(delta) === Math.sign(state.travel)
        ? state.travel + delta
        : delta;
  let shown = state.shown;
  if (y <= height) {
    shown = true;
    travel = 0;
  } else if (travel >= 6) {
    shown = false;
    travel = 0;
  } else if (travel <= -6) {
    shown = true;
    travel = 0;
  }
  return { lastY: y, travel, shown };
}
