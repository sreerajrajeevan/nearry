import test from "node:test";
import assert from "node:assert/strict";
import { maskText, scrubBreadcrumb, scrubEvent } from "../src/utils/crashScrub";

test("personal details are masked in crash text", () => {
  const out = maskText(
    "Failed for anjali@example.com at 9.9312,76.2673 call +91 98765 43210 token=abcd1234efgh eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig",
  );
  assert.doesNotMatch(out, /anjali|98765|9\.9312|abcd1234|eyJhbG/);
  assert.match(out, /\[email\].*\[coords\].*\[number\].*\[token\].*\[token\]/);
  assert.equal(
    maskText("Cannot read property 'title' of undefined"),
    "Cannot read property 'title' of undefined",
  );
});

test("taps and console lines are dropped; URLs lose their query", () => {
  assert.equal(scrubBreadcrumb({ category: "touch", message: "Anjali" }), null);
  assert.equal(scrubBreadcrumb({ category: "console", message: "x" }), null);
  const http = scrubBreadcrumb({
    category: "fetch",
    data: {
      url: "https://x.supabase.co/rest/v1/posts?title=eq.Birthday&author=me",
      method: "GET",
      status_code: 500,
      request_body: "secret",
    },
  })!;
  assert.deepEqual(http.data, {
    url: "https://x.supabase.co/rest/v1/posts",
    method: "GET",
    status_code: 500,
  });
  assert.equal(
    scrubBreadcrumb({ category: "navigation", message: "PostDetails" })!
      .message,
    "PostDetails",
  );
});

test("reports never carry the user, request or extra data", () => {
  const event = scrubEvent({
    user: { id: "u1", email: "a@b.co" },
    request: { data: "body" },
    extra: { note: "hi" },
    message: "Oops for a@b.co",
    exception: { values: [{ value: "Bad input +91 98765 43210" }] },
    breadcrumbs: [
      { category: "touch", message: "Send" },
      { category: "navigation", message: "Chat" },
    ],
  });
  assert.equal(event.user, undefined);
  assert.equal(event.request, undefined);
  assert.equal(event.extra, undefined);
  assert.equal(event.message, "Oops for [email]");
  assert.equal(event.exception!.values![0].value, "Bad input [number]");
  assert.deepEqual(
    event.breadcrumbs!.map((b) => b.message),
    ["Chat"],
  );
});
