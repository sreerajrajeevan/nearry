import test from "node:test";
import assert from "node:assert/strict";
import { mergeMessages } from "../src/utils/chatMessages";
import { proofImageType } from "../src/utils/proofImage";
import type { ChatMessage } from "../src/services/mappers";
test("send and realtime overlap keeps one message and preserves newer local results", () => {
  const msg = (id: string, time: string) =>
    ({ id, createdAt: time, body: id }) as ChatMessage;
  const older = msg("old", "2026-10-17T11:00:00Z"),
    newer = msg("new", "2026-10-17T12:00:00Z");
  assert.deepEqual(
    mergeMessages([newer], [older, newer]).map((m) => m.id),
    ["old", "new"],
  );
  assert.deepEqual(
    mergeMessages([older, newer], [older]).map((m) => m.id),
    ["old", "new"],
  );
});
test("proof uploads preserve actual PNG and JPEG types and reject unsupported or oversized data", () => {
  assert.equal(
    proofImageType(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))
      .contentType,
    "image/png",
  );
  assert.equal(
    proofImageType(new Uint8Array([255, 216, 255, 0])).extension,
    "jpg",
  );
  assert.throws(() => proofImageType(new Uint8Array([1, 2, 3])), /JPEG/);
  assert.throws(
    () => proofImageType(new Uint8Array(10 * 1024 * 1024 + 1)),
    /10 MB/,
  );
});
