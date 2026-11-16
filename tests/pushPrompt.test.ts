import test from "node:test";
import assert from "node:assert/strict";
import {
  pushPromptCopy,
  pushPromptKey,
  shouldOfferPush,
} from "../src/utils/pushPrompt";

const ready = {
  realDevice: true,
  readyAccount: true,
  alreadyAsked: false,
  permission: { status: "undetermined" as const, canAskAgain: true },
};

test("a new account on a phone is asked once about notifications", () => {
  assert.equal(shouldOfferPush(ready), true);
  assert.equal(shouldOfferPush({ ...ready, alreadyAsked: true }), false);
  assert.equal(shouldOfferPush({ ...ready, readyAccount: false }), false);
  assert.equal(shouldOfferPush({ ...ready, realDevice: false }), false);
});

test("never nag someone who already allowed or said no for good", () => {
  assert.equal(
    shouldOfferPush({
      ...ready,
      permission: { status: "granted", canAskAgain: true },
    }),
    false,
  );
  assert.equal(
    shouldOfferPush({
      ...ready,
      permission: { status: "denied", canAskAgain: false },
    }),
    false,
  );
  // Android lets an app ask again after one "Don't allow".
  assert.equal(
    shouldOfferPush({
      ...ready,
      permission: { status: "denied", canAskAgain: true },
    }),
    true,
  );
});

test("the prompt speaks to each kind of account and is stored per account", () => {
  assert.match(pushPromptCopy("personal").body, /join your plan/);
  assert.match(pushPromptCopy("business").body, /books/);
  assert.notEqual(pushPromptKey("a"), pushPromptKey("b"));
});
