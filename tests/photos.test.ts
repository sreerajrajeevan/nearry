import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { imageBytesFromBase64 } from "../src/utils/imageBytes";

const originalFetch = globalThis.fetch;
const calls: { url: URL; method: string; body: unknown; headers: Headers }[] =
  [];
let handler: (url: URL, method: string) => { body: unknown; status?: number };
let photos: typeof import("../src/services/postPhotos");
let storage: typeof import("../src/services/photoStorage");
let posts: typeof import("../src/services/posts");
before(async () => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://nearry-test.invalid";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      typeof input === "string" || input instanceof URL ? input : input.url,
    );
    const method = init?.method ?? "GET";
    calls.push({
      url,
      method,
      body: init?.body,
      headers: new Headers(init?.headers),
    });
    const result = handler(url, method);
    return new Response(JSON.stringify(result.body), {
      status: result.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  photos = await import("../src/services/postPhotos");
  storage = await import("../src/services/photoStorage");
  posts = await import("../src/services/posts");
});
beforeEach(() => {
  calls.length = 0;
  handler = () => ({ body: [] });
});
after(() => {
  globalThis.fetch = originalFetch;
});

test("native file decoding preserves binary image bytes, including base64 padding", () => {
  for (const bytes of [
    Buffer.from([0xff, 0xd8, 0xff]),
    Buffer.from([0, 255]),
    Buffer.from([255]),
  ])
    assert.deepEqual(
      imageBytesFromBase64(bytes.toString("base64")),
      new Uint8Array(bytes),
    );
  assert.throws(() => imageBytesFromBase64("not an image"), /choose it again/);
});

test("photo uploads send actual PNG bytes, correct MIME and SDK authorization", async () => {
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 255]);
  handler = () => ({ body: { Key: "photos/upload", Id: "photo" } });
  const url = await storage.uploadPhotoBytes("host", bytes, "posts");
  const call = calls.find((c) => c.method === "POST")!;
  assert.match(
    call.url.pathname,
    /\/storage\/v1\/object\/photos\/host\/posts\/.*\.png$/,
  );
  assert.deepEqual(new Uint8Array(call.body as Uint8Array), bytes);
  assert.equal(call.headers.get("content-type"), "image/png");
  assert.equal(call.headers.get("apikey"), "test-anon-key");
  assert.equal(call.headers.get("x-upsert"), "false");
  assert.match(
    url,
    /\/storage\/v1\/object\/public\/photos\/host\/posts\/.*\.png$/,
  );
});

test("storage failure surfaces an error; oversized and unsupported files never upload", async () => {
  handler = () => ({
    status: 403,
    body: { message: "Permission denied", statusCode: "403" },
  });
  await assert.rejects(
    storage.uploadPhotoBytes("host", new Uint8Array([255, 216, 255]), "posts"),
    /Permission denied/,
  );
  calls.length = 0;
  await assert.rejects(
    storage.uploadPhotoBytes(
      "host",
      new Uint8Array(storage.MAX_PHOTO_BYTES + 1),
      "posts",
    ),
    /10 MB/,
  );
  await assert.rejects(
    storage.uploadPhotoBytes("host", new Uint8Array([1, 2, 3]), "posts"),
    /JPEG, PNG, or WebP/,
  );
  assert.equal(calls.length, 0);
});

test("failed attachment retries reuse uploaded bytes and preserve cover order", async () => {
  const uploaded: string[] = [],
    attached: string[] = [];
  const upload = async (uri: string) => {
    uploaded.push(uri);
    return `https://photos.test/${uri}.png`;
  };
  let fail = true;
  const attach = async (postId: string, url: string) => {
    assert.equal(postId, "saved-post");
    if (fail) {
      fail = false;
      throw new Error("Connection lost");
    }
    attached.push(url);
  };
  const first = await photos.savePostPhotos(
    "saved-post",
    [{ uri: "first" }, { uri: "second" }],
    upload,
    attach,
  );
  assert.equal(first.error, "Connection lost");
  assert.equal(first.pending[0].uploadedUrl, "https://photos.test/first.png");
  assert.deepEqual(uploaded, ["first"]);
  const retry = await photos.savePostPhotos(
    "saved-post",
    first.pending,
    upload,
    attach,
  );
  assert.deepEqual(retry.pending, []);
  assert.deepEqual(uploaded, ["first", "second"]);
  assert.deepEqual(attached, [
    "https://photos.test/first.png",
    "https://photos.test/second.png",
  ]);
});

test("a failed upload retains only unsaved photos after earlier attachments succeeded", async () => {
  const result = await photos.savePostPhotos(
    "saved-post",
    [{ uri: "one" }, { uri: "two" }, { uri: "three" }],
    async (uri) => {
      if (uri === "two") throw new Error("Offline");
      return uri;
    },
    async () => {},
  );
  assert.deepEqual(result.pending, [{ uri: "two" }, { uri: "three" }]);
  assert.equal(result.error, "Offline");
});

test("a lost attachment response does not produce a duplicate gallery entry", async () => {
  handler = () => ({
    body: [
      {
        id: "existing",
        photo_url: "https://photos.test/one.png",
        sort_order: 0,
      },
    ],
  });
  await photos.addPostPhoto("saved-post", "https://photos.test/one.png");
  assert.ok(calls.every((call) => call.method === "GET"));
});

test("feed covers are fetched in a batch and mapped to their own posts", async () => {
  handler = (url) =>
    url.pathname.endsWith("/post_cards")
      ? {
          body: ["one", "two"].map((id) => ({
            id,
            author_id: "host",
            title: "Coffee",
            description: "A friendly chat",
            starts_at: "2099-01-01T12:00:00Z",
            vacancies: 2,
            status: "open",
            created_at: "2026-01-01T00:00:00Z",
          })),
        }
      : {
          body: [
            {
              post_id: "two",
              photo_url: "https://photos.test/two-cover.png",
              sort_order: 0,
            },
            {
              post_id: "one",
              photo_url: "https://photos.test/one-cover.png",
              sort_order: 0,
            },
            {
              post_id: "one",
              photo_url: "https://photos.test/one-extra.png",
              sort_order: 1,
            },
          ],
        };
  const result = await posts.listPosts();
  assert.deepEqual(
    result.map((post) => post.coverPhotoUrl),
    ["https://photos.test/one-cover.png", "https://photos.test/two-cover.png"],
  );
  assert.equal(
    calls.filter((call) => call.url.pathname.endsWith("/post_photos")).length,
    1,
  );
  const request = calls.find((call) =>
    call.url.pathname.endsWith("/post_photos"),
  )!;
  assert.equal(request.url.searchParams.get("post_id"), "in.(one,two)");
});

test("demo attachments appear in the gallery and feed without network requests", async () => {
  const { setDemoMode } = await import("../src/services/supabase");
  setDemoMode(true);
  try {
    const post = await posts.createPost("demo-user", {
      title: "Coffee with photos",
      description: "A friendly coffee together",
      startsAt: "2099-01-01T12:00:00Z",
      vacancies: 2,
      tags: ["coffee"],
    });
    await photos.addPostPhoto(post.id, "data:image/png;base64,iVBORw0KGgo=");
    const gallery = await photos.listPostPhotos(post.id);
    const feed = await posts.listPosts({ authorId: "demo-user" });
    assert.equal(gallery.length, 1);
    assert.equal(
      feed.find((item) => item.id === post.id)?.coverPhotoUrl,
      gallery[0].photo_url,
    );
    assert.equal(calls.length, 0);
  } finally {
    setDemoMode(false);
  }
});
