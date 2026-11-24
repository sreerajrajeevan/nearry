import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { openPage } from "../scripts/openPage";

const PLAY = "https://play.google.com/store/apps/details?id=com.nearry.app";
const ANDROID = "Mozilla/5.0 (Linux; Android 14) Chrome/120";

/** Runs the page's inline script against a tiny fake DOM. */
function visit(search: string, userAgent = ANDROID) {
  const html = openPage(PLAY);
  const script = /<script>([\s\S]*)<\/script>/.exec(html)![1];
  const els: Record<string, any> = {};
  const el = (id: string) =>
    (els[id] ??= { id, href: "", textContent: "", style: { display: "" } });
  const location = { search, href: "" };
  vm.runInNewContext(script, {
    location,
    navigator: { userAgent },
    document: { getElementById: el },
    URLSearchParams,
    encodeURIComponent,
  });
  return { html, location, els };
}

test("?newplan= opens the new-plan screen on Android with a Play Store fallback", () => {
  const { location, html } = visit("?newplan=v1");
  assert.equal(
    location.href,
    `intent://new-plan?venue=v1#Intent;scheme=nearry;package=com.nearry.app;S.browser_fallback_url=${encodeURIComponent(PLAY)};end`,
  );
  assert.match(html, /Short of players\?/);
  assert.match(html, /Post it on Nearry and nearby players get an alert\./);
});

test("?newplan= on other phones links to the app scheme without redirecting", () => {
  const { location, els } = visit("?newplan=v1", "iPhone Safari");
  assert.equal(location.href, "");
  assert.equal(els.open.href, "nearry://new-plan?venue=v1");
});

test("?plan= still opens the shared plan", () => {
  const { location } = visit("?plan=p1");
  assert.equal(
    location.href,
    `intent://plan/p1#Intent;scheme=nearry;package=com.nearry.app;S.browser_fallback_url=${encodeURIComponent(PLAY)};end`,
  );
});

test("a bad id doesn't redirect and leaves the Play Store button", () => {
  const { location, els } = visit("?newplan=bad%20id");
  assert.equal(location.href, "");
  assert.equal(els.open.style.display, "none");
});
