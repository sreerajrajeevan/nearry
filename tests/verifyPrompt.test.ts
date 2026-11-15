import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyPrompt } from "../src/utils/verifyPrompt";

test("profile verify card: invites, waits, asks again, then gets out of the way", () => {
  const invite = verifyPrompt({ status: "unverified", checked: false });
  assert.equal(invite?.title, "Verify your profile");
  assert.equal(invite?.cta, "Get verified");
  assert.equal(invite?.tone, "invite");

  const waiting = verifyPrompt({ status: "pending", checked: false });
  assert.equal(waiting?.title, "Your selfie is being reviewed");
  assert.equal(waiting?.tone, "waiting");

  const retry = verifyPrompt({
    status: "rejected",
    checked: false,
    note: "Face not clear",
  });
  assert.equal(retry?.title, "Try your selfie again");
  assert.match(retry?.body ?? "", /Face not clear/);
  assert.equal(retry?.cta, "Try again");

  // Verified: no card; the badge shows by the name instead.
  assert.equal(verifyPrompt({ status: "verified", checked: true }), null);
  // Verified earlier but the profile photo changed: ask to verify again.
  const changed = verifyPrompt({ status: "verified", checked: false });
  assert.equal(changed?.title, "Verify your new photo");
});
