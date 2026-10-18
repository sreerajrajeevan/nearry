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

test("My posts requests only the host's posts without hiding past or cancelled listings", async () => {
  handler = () =>
    ["open", "closed", "cancelled"].map((status, index) => ({
      id: `own-${index}`,
      author_id: "host",
      author_name: "Host",
      title: "My plan",
      description: "A past or current plan",
      starts_at: "2020-01-01T12:00:00Z",
      expires_at: "2019-12-31T12:00:00Z",
      vacancies: 2,
      tags: [],
      status,
      created_at: "2019-12-01T12:00:00Z",
    }));
  const result = await posts.listPosts({ authorId: "host", status: "all" });
  const url = calls[0].url;
  assert.equal(url.searchParams.get("author_id"), "eq.host");
  assert.equal(url.searchParams.get("status"), null);
  assert.equal(url.searchParams.get("starts_at"), null);
  assert.equal(url.searchParams.get("or"), null);
  assert.deepEqual(
    result.map((post) => post.status),
    ["open", "closed", "cancelled"],
  );
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

test("demo inbox snapshots refresh after reads and sends without mutating previous results", async () => {
  const { setDemoMode } = await import("../src/services/supabase");
  const { mockConversations, mockMessages } = await import("../src/data/mock");
  const { getUnreadCounts } = await import("../src/services/unread");
  const conversation = mockConversations[0];
  const original = { ...conversation };
  const originalMessages = mockMessages.length;
  setDemoMode(true);
  try {
    conversation.unreadCount = 2;
    const before = await chat.listConversations();
    assert.notEqual(before, mockConversations);
    assert.notEqual(before[0], conversation);
    const unreadBefore = await getUnreadCounts();
    await chat.markConversationRead(conversation.id);
    const read = await chat.listConversations();
    assert.equal(read[0].unreadCount, 0);
    assert.equal(before[0].unreadCount, 2);
    assert.equal((await getUnreadCounts()).messages, unreadBefore.messages - 2);
    await chat.sendMessage(conversation.id, "demo-user", "See you at six!");
    const sent = await chat.listConversations();
    assert.equal(sent[0].lastBody, "See you at six!");
    assert.equal(read[0].lastBody, original.lastBody);
    assert.equal(calls.length, 0);
  } finally {
    Object.assign(conversation, original);
    mockMessages.splice(originalMessages);
    setDemoMode(false);
  }
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

test("place suggestions use the server function contract, never a provider key or venue UUID", async () => {
  const { searchPlaces } = await import("../src/services/places");
  handler = () => ({
    places: [
      {
        provider: "geoapify",
        id: "external-id",
        name: "Infopark",
        address: "Kakkanad",
        latitude: 10,
        longitude: 76,
        attributions: [],
      },
    ],
  });
  const places = await searchPlaces("Infopark", {
    bias: { latitude: 10, longitude: 76 },
  });
  assert.equal(places[0].id, "external-id");
  assert.match(calls[0].url.pathname, /functions\/v1\/place-search$/);
  assert.deepEqual(calls[0].body, {
    query: "Infopark",
    bias: { latitude: 10, longitude: 76 },
  });
  assert.ok(!calls[0].url.searchParams.has("apiKey"));
  calls.length = 0;
  await searchPlaces("in");
  assert.equal(calls.length, 0);
});

test("email login never creates an account, signup passes the chosen role, and no phone is sent", async () => {
  const { sendEmailOtp } = await import("../src/services/emailAuth");
  handler = () => ({});
  await sendEmailOtp(" Person@Example.com ", "personal", undefined, false);
  assert.match(calls[0].url.pathname, /auth\/v1\/otp$/);
  assert.equal(calls[0].body.email, "person@example.com");
  assert.equal(calls[0].body.create_user, false);
  assert.ok(!("phone" in calls[0].body));
  calls.length = 0;
  await sendEmailOtp("owner@example.com", "business", "Owner", true);
  assert.equal(calls[0].body.create_user, true);
  assert.equal(calls[0].body.data.account_type, "business");
  assert.equal(calls[0].body.data.display_name, "Owner");
});

test("badge totals come from one authorized snapshot and count each chat message once", async () => {
  const { getUnreadCounts } = await import("../src/services/unread");
  handler = () => ({ messages: 3, notifications: 5, other_notifications: 2 });
  assert.deepEqual(await getUnreadCounts(), {
    messages: 3,
    notifications: 5,
    activity: 5,
  });
  assert.match(calls[0].url.pathname, /rpc\/unread_counts$/);
});

test("clearing offer price/discount sends null; oversized booking groups never reach the server", async () => {
  const offers = await import("../src/services/offers");
  const bookings = await import("../src/services/bookings");
  handler = () => ({
    id: "offer",
    business_id: "business",
    title: "Offer",
    status: "draft",
    business: { display_name: "Business" },
  });
  await offers.updateOffer("offer", { priceCents: null, discountPct: null });
  assert.deepEqual(calls[0].body.p_patch, {
    price_cents: null,
    discount_pct: null,
  });
  calls.length = 0;
  await assert.rejects(bookings.bookOffer("offer", "slot", 51), /1 and 50/);
  assert.equal(calls.length, 0);
});

test("shared realtime listeners reload after reconnect and remove a channel only after the last unsubscribe", async () => {
  const { getSupabase } = await import("../src/services/supabase");
  const { multiplexSubscribe } = await import("../src/services/realtime");
  const db = getSupabase()!;
  const originalChannel = db.channel,
    originalRemove = db.removeChannel;
  let status: (status: any) => void = () => {};
  let created = 0,
    removed = 0,
    first = 0,
    second = 0;
  const channel = {
    subscribe(fn: typeof status) {
      status = fn;
      return this;
    },
  };
  db.channel = (() => {
    created++;
    return channel;
  }) as any;
  db.removeChannel = (async () => {
    removed++;
    return "ok";
  }) as any;
  try {
    const a = multiplexSubscribe(
      "regression",
      (ch) => ch,
      () => first++,
    );
    const b = multiplexSubscribe(
      "regression",
      (ch) => ch,
      () => second++,
    );
    assert.equal(created, 1);
    status("SUBSCRIBED");
    status("CHANNEL_ERROR");
    status("SUBSCRIBED");
    assert.deepEqual([first, second], [2, 2]);
    a();
    a();
    assert.equal(removed, 0);
    status("SUBSCRIBED");
    assert.deepEqual([first, second], [2, 3]);
    b();
    assert.equal(removed, 1);
  } finally {
    db.channel = originalChannel;
    db.removeChannel = originalRemove;
  }
});
