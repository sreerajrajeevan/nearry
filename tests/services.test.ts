import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Exercise real supabase-js serialization against a fake HTTP server boundary.
// No native modules or live project credentials are required.
const originalFetch = globalThis.fetch;
const calls: { url: URL; method: string; body: any }[] = [];
let handler: (url: URL) => unknown = () => [];
let posts: typeof import("../src/services/posts");
let chat: typeof import("../src/services/chat");
before(async () => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://nearry-test.invalid";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      typeof input === "string" || input instanceof URL ? input : input.url,
    );
    calls.push({
      url,
      method: init?.method || "GET",
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    });
    return new Response(JSON.stringify(handler(url)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  posts = await import("../src/services/posts");
  chat = await import("../src/services/chat");
});
after(() => {
  globalThis.fetch = originalFetch;
});
beforeEach(() => {
  calls.length = 0;
  handler = () => [];
});

test("open-post search keeps expiry and text filters together and quotes punctuation", async () => {
  await posts.listPosts({ search: 'coffee, tea (Sunday) "yes"' });
  const url = calls.find((c) => c.url.pathname.endsWith("/post_cards"))!.url;
  const filter = url.searchParams.get("or")!;
  assert.match(filter, /expires_at/);
  assert.match(filter, /title\.imatch\."/);
  assert.ok(!filter.includes("now()"));
});

test("long conversations fetch the newest page and display it chronologically", async () => {
  handler = () => [
    {
      id: "new",
      conversation_id: "conv",
      sender_id: "other",
      body: "Newest",
      created_at: "2026-10-17T12:00:00Z",
    },
    {
      id: "old",
      conversation_id: "conv",
      sender_id: "other",
      body: "Older",
      created_at: "2026-10-17T11:00:00Z",
    },
  ];
  const messages = await chat.listMessages("conv", "me");
  const url = calls.find((c) => c.url.pathname.endsWith("/messages"))!.url;
  assert.match(url.searchParams.get("order")!, /created_at\.desc/);
  assert.deepEqual(
    messages.map((m) => m.id),
    ["old", "new"],
  );
});

test("offer edits and cancellations use the authorized RPC, without follow-up side effects", async () => {
  const offers = await import("../src/services/offers");
  handler = () => ({
    id: "offer",
    business_id: "business",
    title: "Haircut",
    description: "A friendly haircut",
    starts_at: "2026-10-18T12:00:00Z",
    ends_at: "2026-10-18T14:00:00Z",
    status: "live",
    slot_capacity: 1,
    business: { display_name: "Salon" },
  });
  const result = await offers.updateOffer("offer", { title: "Haircut" });
  assert.equal(result.businessName, "Salon");
  await offers.cancelOffer("offer");
  assert.equal(calls.length, 2);
  assert.ok(
    calls.every((call) => call.url.pathname.endsWith("/rpc/update_offer")),
  );
  assert.deepEqual(calls[1].body, {
    p_offer_id: "offer",
    p_patch: { status: "cancelled" },
  });
});

test("clearing optional post fields sends explicit nulls, and venue search quotes punctuation", async () => {
  handler = () => ({
    id: "post",
    author_id: "host",
    title: "Football",
    description: "Friendly football game",
    starts_at: "2026-10-18T12:00:00Z",
    vacancies: 2,
    tags: [],
    status: "open",
  });
  await posts.updatePost("post", { costCents: null, expiresAt: null });
  assert.equal(calls[0].body.cost_cents, null);
  assert.equal(calls[0].body.expires_at, null);
  calls.length = 0;
  handler = () => [];
  const venues = await import("../src/services/venues");
  await venues.searchVenues("50%, (park)");
  const value = calls[0].url.searchParams.get("or")!;
  assert.match(value, /name\.imatch\."/);
  assert.ok(value.includes("50%"));
  assert.ok(value.includes("\\\\(park\\\\)"));
});

test("a read acknowledgement includes the last displayed message id", async () => {
  await chat.markConversationRead("conv", "last");
  assert.deepEqual(calls[0].body, {
    p_conversation_id: "conv",
    p_last_message_id: "last",
  });
  calls.length = 0;
  await chat.markConversationRead("empty");
  assert.equal(calls.length, 0);
});

test("demo requests enforce capacity and leaving a full post reopens it", async () => {
  const { setDemoMode } = await import("../src/services/supabase");
  const requests = await import("../src/services/joinRequests");
  const { mockPosts } = await import("../src/data/mock");
  setDemoMode(true);
  try {
    const post = await posts.createPost("host", {
      title: "Audit game",
      description: "Friendly audit game",
      startsAt: new Date(Date.now() + 7200000).toISOString(),
      vacancies: 1,
      tags: [],
    });
    await assert.rejects(requests.requestToJoin(post.id, "host"), /own post/);
    const first = await requests.requestToJoin(post.id, "participant");
    await assert.rejects(
      requests.requestToJoin(post.id, "participant"),
      /already/,
    );
    const result = await requests.approveRequest(first.id);
    assert.deepEqual(result, { spotsLeft: 0, postClosed: true });
    await assert.rejects(requests.requestToJoin(post.id, "other"), /full/);
    await requests.cancelParticipation(first.id);
    assert.equal(mockPosts.find((p) => p.id === post.id)?.status, "open");
    assert.equal(mockPosts.find((p) => p.id === post.id)?.spotsLeft, 1);
  } finally {
    setDemoMode(false);
  }
});
