import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function exportPages(
  owner: string,
  email: string,
  check: (dir: string, status: number | null) => void,
) {
  const dir = mkdtempSync(join(tmpdir(), "nearry-policies-"));
  try {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/export-legal.ts"],
      {
        cwd: new URL("../", import.meta.url),
        env: {
          ...process.env,
          EXPO_PUBLIC_LEGAL_OWNER: owner,
          EXPO_PUBLIC_SUPPORT_EMAIL: email,
          LEGAL_OUTPUT_DIR: dir,
        },
        encoding: "utf8",
      },
    );
    check(dir, result.status);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("public policy exports have working links, deletion instructions and child-safety standards without injecting operator HTML", () => {
  exportPages(
    'Test Operator <script>alert("test")</script>',
    "support@nearry.app",
    (dir, status) => {
      assert.equal(status, 0);
      for (const name of [
        "index",
        "privacy",
        "terms",
        "delete-account",
        "child-safety",
      ]) {
        const html = readFileSync(join(dir, `${name}.html`), "utf8");
        assert.doesNotMatch(html, /<script>/);
        assert.match(html, /&lt;script&gt;/);
        for (const [, href] of html.matchAll(/href="([^":]+\.html)"/g))
          assert.ok(existsSync(join(dir, href)), `Missing policy link ${href}`);
      }
      const safety = readFileSync(join(dir, "child-safety.html"), "utf8");
      assert.match(safety, /child sexual abuse and exploitation \(CSAE\)/i);
      assert.match(safety, /National Center for Missing/);
      assert.match(safety, /support@nearry.app/);
      assert.match(
        readFileSync(join(dir, "delete-account.html"), "utf8"),
        /Without reinstalling/,
      );
      assert.match(
        readFileSync(join(dir, "privacy.html"), "utf8"),
        /email sign-in codes/,
      );
    },
  );
});

test("public policies refuse missing or placeholder owner/contact settings", () => {
  for (const [owner, email] of [
    ["", ""],
    ["Your company", "support@nearry.app"],
    ["Test Operator", "support@example.com"],
    ["Test Operator", "support@EXAMPLE.COM"],
  ])
    exportPages(owner, email, (dir, status) => {
      assert.notEqual(status, 0);
      assert.equal(existsSync(join(dir, "privacy.html")), false);
    });
});
