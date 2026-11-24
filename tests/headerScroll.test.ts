import test from "node:test";
import assert from "node:assert/strict";
import { headerScrollState } from "../src/utils/headerScroll";
test("slow scrolling accumulates movement and reveals the header before reaching the top", () => {
  let state = { lastY: 500, travel: 0, shown: false };
  for (const y of [498, 496, 494]) state = headerScrollState(state, y, 64);
  assert.equal(state.shown, true);
  for (const y of [496, 498, 500]) state = headerScrollState(state, y, 64);
  assert.equal(state.shown, false);
  assert.equal(headerScrollState(state, -10, 64).shown, true);
});
test("reversing direction resets the deadband and invalid offsets stay stable", () => {
  let state = { lastY: 500, travel: 4, shown: true };
  state = headerScrollState(state, 498, 64);
  assert.equal(state.travel, -2);
  assert.equal(state.shown, true);
  assert.equal(headerScrollState(state, NaN, 64).lastY, 498);
});
