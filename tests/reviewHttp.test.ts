import test from "node:test";
import assert from "node:assert/strict";
import { createReviewHandler } from "../supabase/functions/_shared/reviewHandler";
import { signReviewToken } from "../supabase/functions/_shared/reviewToken";
const proof = {
  user_id: "00000000-0000-0000-0000-000000000001",
  review_id: "00000000-0000-0000-0000-000000000002",
  document_path: "00000000-0000-0000-0000-000000000001/proof.jpg",
  exp: Date.now() + 60000,
};
function backend({ stale = false, fail = false, venue = null as any } = {}) {
  const calls: any[] = [];
  return {
    calls,
    from(table: string) {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async single() {
          return {
            data:
              table === "profiles"
                ? {
                    verification_status: "pending",
                    verification_doc_path: proof.document_path,
                    display_name: "Test Business",
                  }
                : {
                    venue_submission: venue,
                    id: proof.review_id,
                    user_id: proof.user_id,
                    document_path: proof.document_path,
                    reviewed_at: stale ? "2026-10-01" : null,
                  },
            error: null,
          };
        },
      };
    },
    storage: {
      from() {
        return {
          async createSignedUrl() {
            return {
              data: { signedUrl: "https://test.invalid/private-proof" },
              error: null,
            };
          },
        };
      },
    },
    async rpc(name: string, args: unknown) {
      calls.push({ name, args });
      return { error: fail ? { message: "already reviewed" } : null };
    },
  };
}
test("email link scanners and GET decision parameters cannot approve a business", async () => {
  const db = backend(),
    token = await signReviewToken(proof, "secret");
  const response = await createReviewHandler(
    db,
    "secret",
  )(
    new Request(`https://test.invalid/review?token=${token}&decision=approved`),
  );
  assert.equal(response.status, 200);
  assert.equal(db.calls.length, 0);
  assert.match(await response.text(), /Confirm approval/);
  assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});
test("an explicit POST reviews the bound submission and a failed transaction is not reported as success", async () => {
  const token = await signReviewToken(proof, "secret");
  for (const fail of [false, true]) {
    const db = backend({ fail });
    const response = await createReviewHandler(
      db,
      "secret",
    )(
      new Request("https://test.invalid/review", {
        method: "POST",
        body: new URLSearchParams({
          token,
          decision: "rejected",
          reason: "Clearer image needed",
        }),
      }),
    );
    assert.equal(response.status, fail ? 409 : 200);
    assert.deepEqual(db.calls, [
      {
        name: "review_verification",
        args: {
          p_review_id: proof.review_id,
          p_decision: "rejected",
          p_reason: "Clearer image needed",
          p_location_confirmed: false,
        },
      },
    ]);
  }
});
test("invalid, stale and already-reviewed links perform no writes", async () => {
  const token = await signReviewToken(proof, "secret");
  const db = backend({ stale: true });
  for (const value of ["broken", token]) {
    const response = await createReviewHandler(
      db,
      "secret",
    )(
      new Request("https://test.invalid/review", {
        method: "POST",
        body: new URLSearchParams({ token: value, decision: "approved" }),
      }),
    );
    assert.ok([403, 409].includes(response.status));
  }
  assert.equal(db.calls.length, 0);
});

test("business review shows escaped submitted location and requires explicit map confirmation", async () => {
  const venue = {
    name: "Park <Café>",
    category: "Café",
    address: "12 Park Road <script>bad()</script>",
    area: "Kakkanad",
    latitude: 10.01,
    longitude: 76.35,
  };
  const token = await signReviewToken(proof, "secret");
  const db = backend({ venue });
  const handler = createReviewHandler(db, "secret");
  const html = await (
    await handler(new Request(`https://test.invalid/review?token=${token}`))
  ).text();
  assert.match(html, /Park &lt;Café&gt;/);
  assert.match(html, /maps\/search/);
  assert.doesNotMatch(html, /<script>bad/);
  for (const locationConfirmed of ["", "yes"]) {
    const response = await handler(
      new Request("https://test.invalid/review", {
        method: "POST",
        body: new URLSearchParams({
          token,
          decision: "approved",
          locationConfirmed,
        }),
      }),
    );
    assert.equal(response.status, locationConfirmed ? 200 : 400);
  }
  assert.equal(db.calls.length, 1);
  const legacy = backend();
  const response = await createReviewHandler(
    legacy,
    "secret",
  )(
    new Request("https://test.invalid/review", {
      method: "POST",
      body: new URLSearchParams({
        token,
        decision: "approved",
        locationConfirmed: "yes",
      }),
    }),
  );
  assert.equal(response.status, 400);
  assert.equal(legacy.calls.length, 0);
});
