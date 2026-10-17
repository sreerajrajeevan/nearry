import test from "node:test";
import assert from "node:assert/strict";
import {
  signReviewToken,
  verifyReviewToken,
} from "../supabase/functions/_shared/reviewToken";
const input = {
  user_id: "00000000-0000-0000-0000-000000000001",
  review_id: "00000000-0000-0000-0000-000000000002",
  document_path: "00000000-0000-0000-0000-000000000001/प्रमाण.png",
  exp: Date.now() + 60000,
};
test("review tokens bind the user, submission and Unicode document path", async () => {
  const token = await signReviewToken(input, "test-secret");
  assert.deepEqual(await verifyReviewToken(token, "test-secret"), input);
  assert.equal(await verifyReviewToken(token, "wrong-secret"), null);
  assert.equal(await verifyReviewToken(token, "test-secret", input.exp), null);
  assert.equal(await verifyReviewToken(token + ".extra", "test-secret"), null);
  const changed = token.replace(/.$/, token.endsWith("a") ? "b" : "a");
  assert.equal(await verifyReviewToken(changed, "test-secret"), null);
});
test("even signed tokens require a finite expiry and a valid document owner", async () => {
  for (const patch of [
    { exp: undefined },
    { exp: "tomorrow" },
    { exp: Infinity },
    { user_id: "x" },
    { review_id: "x" },
    { document_path: "another-user/proof.png" },
  ]) {
    const token = await signReviewToken(
      { ...input, ...patch } as any,
      "test-secret",
    );
    assert.equal(await verifyReviewToken(token, "test-secret"), null);
  }
  for (const token of ["", "bad", "a.x", "☀.00"])
    assert.equal(await verifyReviewToken(token, "test-secret"), null);
});
