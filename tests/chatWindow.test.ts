import test from "node:test";
import assert from "node:assert/strict";
import { mergeRefreshed, refreshWindow } from "../src/utils/chatWindow";

const msgs = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({
    id: `m${from + i}`,
    seq: from + i,
  }));

test("a refresh reloads at most the newest 500, at least 60", () => {
  assert.equal(refreshWindow(0), 60);
  assert.equal(refreshWindow(120), 120);
  assert.equal(refreshWindow(900), 500);
});

test("a refresh replaces the newest window and keeps older pages already loaded", () => {
  // 700 loaded (seq 1..700); a refresh brings the newest 500 (seq 201..701),
  // one of them (seq 650) was removed, and seq 701 arrived.
  const fresh = [...msgs(201, 649), ...msgs(651, 701)];
  const merged = mergeRefreshed(msgs(1, 700), fresh, 500);
  assert.equal(merged[0].seq, 1);
  assert.equal(merged.at(-1)!.seq, 701);
  assert.ok(!merged.some((m) => m.seq === 650));
  assert.equal(new Set(merged.map((m) => m.id)).size, merged.length);
});

test("when the refresh covers the whole chat, it is the whole list", () => {
  const merged = mergeRefreshed(msgs(1, 40), msgs(2, 41), 60);
  assert.deepEqual(
    merged.map((m) => m.seq),
    msgs(2, 41).map((m) => m.seq),
  );
});
