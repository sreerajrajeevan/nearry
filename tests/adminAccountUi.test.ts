import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
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
        showModal() {
          this.open = true;
        },
        close() {
          this.open = false;
        },
      });
    return elements.get(id);
  };
  const buttons = ["suspend", "unsuspend", "cancel-deletion"].map((id) =>
    element(id),
  );
  const document = {
    getElementById: element,
    querySelectorAll: () => buttons,
    querySelector: (selector: string) =>
      element(selector.match(/="([^"]+)"/)![1]),
  };
  const source = readFileSync("admin/app.js", "utf8")
    .replace(/^import .*;\n/, "")
    .split("start().catch")[0];
  const context: any = { window: { NEARRY_ADMIN_CONFIG: {} }, document };
  runInNewContext(
    source +
      `\nrole = "owner"; globalThis.ui = {
    openAccount, closeAccount,
    setCall: (callback) => { call = callback; },
    selected: () => selectedAccount,
  };`,
    context,
  );
  return { ui: context.ui, element };
}
const account = (id: string, job: any = null) => ({
  id,
  display_name: id,
  account_type: "personal",
  deletion_requested_at: "2026-11-12",
  deletionJob: job,
});
test("admin account modal discards a response after closing or opening another account", async () => {
  const f = fixture();
  let resolveFirst: any;
  f.ui.setCall(
    () =>
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
  );
  const first = f.ui.openAccount("old");
  f.ui.closeAccount();
  f.ui.setCall(async () => account("new", { attempts: 0 }));
  await f.ui.openAccount("new");
  resolveFirst(account("old"));
  await first;
  assert.equal(f.ui.selected().id, "new");
  assert.equal(f.element("account-title").textContent, "new");
  f.ui.setCall(
    () =>
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
  );
  const closed = f.ui.openAccount("closed");
  assert.equal(f.ui.selected(), null);
  f.ui.closeAccount();
  resolveFirst(account("closed"));
  await closed;
  assert.equal(f.ui.selected(), null);
  assert.equal(f.element("account-dialog").open, false);
  assert.equal(f.element("account-details").innerHTML, "");
});
test("admin modal only offers cancellation for a deletion job that has never started", async () => {
  for (const [job, hidden] of [
    [null, true],
    [{ attempts: 0, started: false }, false],
    [{ attempts: 1 }, true],
    [{ attempts: 0, started: true }, true],
    [{ attempts: 0, prepared_at: "2026-11-12" }, true],
  ] as const) {
    const f = fixture();
    f.ui.setCall(async () => account("member", job));
    await f.ui.openAccount("member");
    assert.equal(
      f.element("cancel-deletion").hidden,
      hidden,
      JSON.stringify(job),
    );
  }
});
