import { test } from "node:test";
import assert from "node:assert/strict";
import { partyLimit, partyLimitNote } from "../src/utils/partySize";

test("party size tops out at 4 people or the seats left, whichever is lower", () => {
  assert.equal(partyLimit(10), 4);
  assert.equal(partyLimit(3), 3);
  assert.equal(partyLimit(0), 1);
  assert.equal(partyLimit(undefined), 4);
});

test("a note explains why + stops, only once the limit is reached", () => {
  assert.equal(partyLimitNote(2, 10), null);
  assert.equal(partyLimitNote(4, 10), "4 people is the most for one booking.");
  assert.equal(partyLimitNote(3, 3), "Only 3 places left in this slot.");
  assert.equal(partyLimitNote(1, 1), "Only 1 place left in this slot.");
});
