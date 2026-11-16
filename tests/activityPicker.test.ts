import test from "node:test";
import assert from "node:assert/strict";
import { PLAN_ACTIVITIES } from "../src/utils/planComposer";

test("every plan activity shows an illustration or an outline icon, never emoji", () => {
  for (const item of PLAN_ACTIVITIES) {
    assert.ok(item.art || ("icon" in item && item.icon), item.id);
    assert.ok(!("emoji" in item), item.id);
    assert.doesNotMatch(item.label, /\p{Extended_Pictographic}/u);
  }
});
