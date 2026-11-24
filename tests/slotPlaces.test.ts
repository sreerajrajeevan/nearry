import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PLACES,
  typedPlaces,
  settledPlaces,
} from "../src/utils/slotPlaces";

test("typing people per slot keeps digits only and caps at 500", () => {
  assert.equal(MAX_PLACES, 500);
  assert.equal(typedPlaces("40"), "40");
  assert.equal(typedPlaces("4a0 "), "40");
  assert.equal(typedPlaces(""), "");
  assert.equal(typedPlaces("999"), "500");
  assert.equal(typedPlaces("007"), "7");
});

test("leaving the field settles an empty or zero value at 1", () => {
  assert.equal(settledPlaces(""), "1");
  assert.equal(settledPlaces("0"), "1");
  assert.equal(settledPlaces("25"), "25");
});
