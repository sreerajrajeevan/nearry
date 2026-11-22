import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

/** Runs admin/app.js against a minimal fake DOM, like adminAccountUi. */
function fixture() {
  const elements = new Map<string, any>();
  const element = (id: string) => {
    if (!elements.has(id))
      elements.set(id, {
        hidden: true,
        open: false,
        value: "",
        textContent: "",
        innerHTML: "",
        checked: false,
        showModal() {
          this.open = true;
        },
        close() {
          this.open = false;
        },
        removeAttribute() {},
        classList: { toggle() {} },
      });
    return elements.get(id);
  };
  const document = {
    getElementById: element,
    querySelectorAll: () => [],
    querySelector: () => element("any"),
  };
  const source = readFileSync("admin/app.js", "utf8")
    .replace(/^import .*;\n/, "")
    .split("start().catch")[0];
  const context: any = {
    window: {
      NEARRY_ADMIN_CONFIG: { supabaseUrl: "https://project.supabase.co" },
    },
    document,
  };
  runInNewContext(
    source +
      `\nrole = "owner"; globalThis.ui = {
    closeDialog, renderReportContext, loadReportContext,
    setCall: (callback) => { call = callback; },
    select: (item) => { selected = item; },
  };`,
    context,
  );
  return { ui: context.ui, element };
}

const ctx = {
  report: {
    id: "r1",
    reason: "harassment",
    details: "<script>alert(1)</script> keeps messaging me",
    target_kind: "message",
    created_at: "2026-11-17T10:41:00Z",
  },
  reporter: {
    id: "u1",
    account_type: "personal",
    display_name: "Asha",
    email: "asha@example.com",
    created_at: "2026-10-02T09:00:00Z",
    reportsFiled: { total: 3, open: 1, upheld: 1, dismissed: 1 },
  },
  subject: {
    id: "u2",
    account_type: "business",
    display_name: "Renil",
    business_name: "Café Nine",
    email: "renil@example.com",
    verification_status: "verified",
    created_at: "2026-10-02T09:00:00Z",
    otherReportsAgainst: { total: 0, open: 0, upheld: 0, dismissed: 0 },
    recentReportsAgainst: [],
  },
  content: {
    kind: "message",
    missing: false,
    removedAt: null,
    title: "Private chat message",
    fields: [],
    images: ["https://evil.example/x.png"],
    messages: [
      {
        sender: "Renil",
        body: "<b>hi</b>",
        at: "2026-11-17T10:07:00Z",
        reported: true,
      },
    ],
  },
};

test("closing a review no longer throws (venue reset used undefined variables)", () => {
  const f = fixture();
  f.element("review-note").value = "draft reason";
  assert.doesNotThrow(() => f.ui.closeDialog(true));
  assert.equal(f.element("review-note").value, "");
  assert.equal(f.element("venue-review").hidden, true);
});

test("report review shows reporter, reported person and content, escaped", () => {
  const f = fixture();
  f.ui.renderReportContext(ctx);
  const html = f.element("report-context").innerHTML;
  assert.match(html, /Reported by/);
  assert.match(html, /asha@example\.com/);
  assert.match(html, /Café Nine \(Renil\)/);
  assert.match(html, /3 \(1 open, 1 upheld, 1 dismissed\)/);
  assert.match(html, /Other reports against them<\/span><strong>None/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;b&gt;hi&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<script>|<b>hi/);
  assert.doesNotMatch(html, /evil\.example/);
  assert.match(html, /msg reported/);
  assert.match(html, /data-account="u1"/);
  assert.match(html, /data-account="u2"/);
});

test("a late report response is ignored once the review is closed or changed", async () => {
  const f = fixture();
  let resolve: any;
  f.ui.setCall(() => new Promise((r) => (resolve = r)));
  f.ui.select({ id: "r1", kind: "report" });
  const pending = f.ui.loadReportContext({ id: "r1" });
  f.ui.closeDialog(true);
  resolve(ctx);
  await pending;
  assert.equal(f.element("report-context").innerHTML, "");
});
