import test from "node:test";
import assert from "node:assert/strict";
import {
  createReviewHandler,
  adminDashboardUrl,
} from "../supabase/functions/_shared/reviewHandler";
import { signReviewToken } from "../supabase/functions/_shared/reviewToken";
test("old business email links disclose no proof or account data and cannot approve or reject", async () => {
  const db = new Proxy(
    {},
    {
      get() {
        throw new Error("Bearer links must never access the database");
      },
    },
  );
  const token = await signReviewToken(
    {
      user_id: "00000000-0000-0000-0000-000000000001",
      review_id: "00000000-0000-0000-0000-000000000002",
      document_path: "private/proof.jpg",
      exp: Date.now() + 60000,
    },
    "secret",
  );
  for (const method of ["GET", "POST"]) {
    const req = new Request(
      "https://test.invalid/review?token=" + token + "&decision=approved",
      {
        method,
        ...(method === "POST"
          ? { body: new URLSearchParams({ token, decision: "rejected" }) }
          : {}),
      },
    );
    const response = await createReviewHandler(
        db,
        "secret",
        "https://admin.example/dashboard",
      )(req),
      html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /authenticator/);
    assert.match(html, /https:\/\/admin.example\/dashboard/);
    assert.doesNotMatch(
      html,
      /private\/proof|<form|<iframe|Confirm approval|token=/,
    );
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
  }
});
test("dashboard handoff is configured server-side, strips credentials/query and fails safely", async () => {
  for (const url of [
    "javascript:alert(1)",
    "https://user:password@admin.example",
    "http://admin.example",
    "",
    undefined,
  ])
    assert.equal(adminDashboardUrl(url), null);
  assert.equal(
    adminDashboardUrl("https://admin.example/?token=secret#proof"),
    "https://admin.example/",
  );
  const handler = createReviewHandler(null, "");
  const html = await (
    await handler(
      new Request("https://test.invalid/review?redirect=https://evil.example"),
    )
  ).text();
  assert.doesNotMatch(html, /evil.example|href=/);
  assert.match(html, /saved Nearry Admin/);
  assert.equal(
    (await handler(new Request("https://test.invalid", { method: "DELETE" })))
      .status,
    405,
  );
});
