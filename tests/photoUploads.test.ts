import { test } from "node:test";
import assert from "node:assert/strict";
import { createUploadQueue } from "../src/services/photoUploads";

const tick = () => new Promise((r) => setTimeout(r, 0));

test("a picked photo starts uploading at once and reports its status", async () => {
  const seen: string[] = [];
  const q = createUploadQueue(
    async (uri) => `url:${uri}`,
    async () => {},
    {
      retryDelayMs: 0,
    },
  );
  q.subscribe(() => seen.push(q.status("a") ?? "none"));
  q.start("a");
  assert.equal(q.status("a"), "uploading");
  assert.equal((await q.settle(["a"])).get("a"), "url:a");
  assert.equal(q.status("a"), "done");
  assert.deepEqual(seen.at(-1), "done");
});

test("changing the photo deletes the old upload, even one still in flight", async () => {
  const removed: string[] = [];
  let finish!: (url: string) => void;
  const q = createUploadQueue(
    (uri) =>
      uri === "slow"
        ? new Promise<string>((r) => (finish = r))
        : Promise.resolve(`url:${uri}`),
    async (url) => {
      removed.push(url);
    },
    { retryDelayMs: 0 },
  );
  q.start("first");
  await q.settle(["first"]);
  q.cancel("first");
  await tick();
  assert.deepEqual(removed, ["url:first"]);
  q.start("slow");
  q.cancel("slow");
  finish("url:slow");
  await tick();
  await tick();
  assert.deepEqual(removed, ["url:first", "url:slow"]);
  assert.equal(q.status("slow"), undefined);
});

test("uploads retry on their own; a photo that never uploads settles as null", async () => {
  let calls = 0;
  const q = createUploadQueue(
    async (uri) => {
      calls++;
      if (uri === "flaky" && calls < 3) throw new Error("network");
      if (uri === "broken") throw new Error("network");
      return `url:${uri}`;
    },
    async () => {},
    { retries: 2, retryDelayMs: 0 },
  );
  q.start("flaky");
  assert.equal((await q.settle(["flaky"])).get("flaky"), "url:flaky");
  calls = 0;
  q.start("broken");
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(q.status("broken"), "failed");
  assert.equal(calls, 3);
  // Publishing gives a failed photo one more full round of tries.
  const result = await q.settle(["broken"]);
  assert.equal(result.get("broken"), null);
  assert.equal(calls, 6);
});

test("settling a photo that was never started starts it", async () => {
  const q = createUploadQueue(
    async (uri) => `url:${uri}`,
    async () => {},
    {
      retryDelayMs: 0,
    },
  );
  assert.equal((await q.settle(["new"])).get("new"), "url:new");
});

test("an unused upload's storage paths come from its public URL", async () => {
  const { uploadedPhotoPaths } = await import("../src/services/photoStorage");
  assert.deepEqual(
    uploadedPhotoPaths(
      "https://x.supabase.co/storage/v1/object/public/photos/u1/posts/17-ab-full.jpg",
    ),
    ["u1/posts/17-ab-full.jpg", "u1/posts/17-ab-thumb.jpg"],
  );
  assert.deepEqual(
    uploadedPhotoPaths(
      "https://x.supabase.co/storage/v1/object/public/photos/u1/posts/17-ab.png",
    ),
    ["u1/posts/17-ab.png"],
  );
  assert.deepEqual(uploadedPhotoPaths("file:///local/photo.jpg"), []);
  assert.deepEqual(
    uploadedPhotoPaths(
      "https://x.supabase.co/storage/v1/object/public/avatars/u1/a.jpg",
    ),
    [],
  );
});
