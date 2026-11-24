import { test } from "node:test";
import assert from "node:assert/strict";
import { qrMatrix } from "../src/utils/qrMatrix";

test("QR matrix is a valid square code with the three finder patterns", () => {
  const m = qrMatrix("https://x.test/open.html?newplan=v1");
  const n = m.length;
  assert.ok(n >= 21);
  assert.equal(n % 4, 1);
  for (const row of m) assert.equal(row.length, n);
  const finder = (r0: number, c0: number) => {
    for (let i = 0; i < 7; i++) {
      // 7×7 dark border
      assert.equal(m[r0][c0 + i], true);
      assert.equal(m[r0 + 6][c0 + i], true);
      assert.equal(m[r0 + i][c0], true);
      assert.equal(m[r0 + i][c0 + 6], true);
    }
    for (let r = 2; r < 5; r++)
      for (let c = 2; c < 5; c++) assert.equal(m[r0 + r][c0 + c], true);
    // light ring between border and centre
    assert.equal(m[r0 + 1][c0 + 1], false);
  };
  finder(0, 0);
  finder(0, n - 7);
  finder(n - 7, 0);
});
