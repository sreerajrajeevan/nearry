import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

function dashboard() {
  const elements = new Map<string, any>();
  const element = (id: string) => {
    if (!elements.has(id))
      elements.set(id, {
        hidden: true,
        textContent: "",
        value: "",
        checked: false,
        classList: { toggle() {} },
        removeAttribute() {},
        showModal() {},
      });
    return elements.get(id);
  };
  const document = {
    getElementById: element,
    querySelectorAll: () => [],
    querySelector: (selector: string) => element(selector),
  };
  const source = readFileSync("admin/app.js", "utf8")
    .replace(/^import .*;\n/, "")
    .split("start().catch")[0];
  const context: any = { window: { NEARRY_ADMIN_CONFIG: {} }, document };
  runInNewContext(
    source +
      `\nglobalThis.ui = { open(rows, id) { currentRows = rows; openReview(id, "selfie"); } };`,
    context,
  );
  return { ui: context.ui, element };
}

test("admin: the selfie review shows the pose that was asked for", () => {
  const d = dashboard();
  d.ui.open(
    [
      {
        id: "s1",
        display_name: "Asha",
        submitted_at: "2026-11-15T10:00:00Z",
        pose_label: "Peace sign next to your face",
      },
    ],
    "s1",
  );
  assert.equal(d.element("selfie-pose").hidden, false);
  assert.match(
    d.element("selfie-pose").textContent,
    /Peace sign next to your face/,
  );
  assert.match(d.element("proof-check-label").textContent, /requested pose/);
});

test("admin: a selfie from an older app build is marked as having no pose", () => {
  const d = dashboard();
  d.ui.open(
    [
      {
        id: "s2",
        display_name: "Ravi",
        submitted_at: "2026-11-15T10:00:00Z",
        pose_label: null,
      },
    ],
    "s2",
  );
  assert.equal(d.element("selfie-pose").hidden, false);
  assert.match(d.element("selfie-pose").textContent, /No pose/i);
});
