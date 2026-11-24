import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Exercise real supabase-js serialization against a fake HTTP server boundary.
// No native modules or live project credentials are required.
const originalFetch = globalThis.fetch;
const calls: { url: URL; method: string; body: any }[] = [];
let handler: (url: URL) => unknown = () => [];
let responseStatus = 200;
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
      status: responseStatus,
      headers: {
        "Content-Type": "application/json",
        "X-Supabase-Api-Version": "2024-01-01",
      },
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
  responseStatus = 200;
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

test("publishing, reloading and editing preserve every post audience through the live service paths", async () => {
  for (const audience of ["female", "male", "any"] as const) {
    calls.length = 0;
    let row: any = {
      id: "audience-post",
      author_id: "host",
      author_name: "Host",
      approved_count: 0,
      status: "open",
      created_at: new Date().toISOString(),
    };
    handler = (url) => {
      const call = calls[calls.length - 1];
      if (url.pathname.endsWith("/posts")) {
        Object.assign(row, call.body);
        return { ...row };
      }
      if (url.pathname.endsWith("/post_cards"))
        return url.searchParams.has("id") ? { ...row } : [{ ...row }];
      return [];
    };
    const created = await posts.createPost("host", {
      title: "Audience selection",
      venueId: "test-venue",
      venueName: "Test venue",
      description: "A friendly plan with the selected audience",
      startsAt: new Date(Date.now() + 14400000).toISOString(),
      vacancies: 4,
      tags: [],
      genderPreference: audience,
    });
    assert.equal(calls[0].body.gender_preference, audience);
    assert.equal(created.genderPreference, audience);
    assert.equal((await posts.getPost(created.id))!.genderPreference, audience);
    assert.equal((await posts.listPosts())[0].genderPreference, audience);
    assert.equal(
      (await posts.listPosts({ authorId: "host", status: "all" }))[0]
        .genderPreference,
      audience,
    );
    const changed = audience === "female" ? "male" : "female";
    const edited = await posts.updatePost(created.id, {
      genderPreference: changed,
    });
    assert.equal(
      calls.find((call) => call.method === "PATCH")!.body.gender_preference,
      changed,
    );
    assert.equal(edited.genderPreference, changed);
    assert.equal((await posts.getPost(created.id))!.genderPreference, changed);
  }
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

test("demo inbox snapshots refresh after reads, and sending is refused", async () => {
  const { setDemoMode } = await import("../src/services/supabase");
  const { mockConversations } = await import("../src/data/mock");
  const { getUnreadCounts } = await import("../src/services/unread");
  const conversation = mockConversations[0];
  const original = { ...conversation };
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
    await assert.rejects(
      chat.sendMessage(conversation.id, "demo-user", "See you at six!"),
      /can't send messages/,
    );
    assert.equal(
      (await chat.listConversations())[0].lastBody,
      original.lastBody,
    );
    assert.equal(calls.length, 0);
  } finally {
    Object.assign(conversation, original);
    setDemoMode(false);
  }
});

test("the demo refuses every write and leaves the sample data unchanged", async () => {
  const { setDemoMode } = await import("../src/services/supabase");
  const requests = await import("../src/services/joinRequests");
  const groups = await import("../src/services/planGroups");
  const bookings = await import("../src/services/bookings");
  const offers = await import("../src/services/offers");
  const safety = await import("../src/services/safety");
  const { mockPosts, mockBookings, mockOffers } =
    await import("../src/data/mock");
  const snapshot = JSON.stringify([mockPosts, mockBookings, mockOffers]);
  setDemoMode(true);
  try {
    const refused: [string, () => Promise<unknown>][] = [
      [
        "post plans",
        () =>
          posts.createPost("demo-user", {
            title: "Audit game",
            venueId: "test-venue",
            venueName: "Test venue",
            description: "Friendly audit game",
            startsAt: new Date(Date.now() + 7200000).toISOString(),
            vacancies: 1,
            tags: [],
          }),
      ],
      ["edit plans", () => posts.updatePost(mockPosts[0].id, { title: "x" })],
      ["cancel plans", () => posts.cancelPost(mockPosts[0].id)],
      [
        "join plans",
        () => requests.requestToJoin(mockPosts[0].id, "demo-user"),
      ],
      ["approve requests", () => requests.approveRequest("r1")],
      [
        "send messages",
        () => groups.sendPlanGroupMessage("g", "demo-user", "hi"),
      ],
      ["book offers", () => bookings.bookOffer(mockOffers[0].id, "s", 1)],
      ["publish offers", () => offers.publishOffer(mockOffers[0].id)],
      ["send reports", () => safety.reportContent({} as never)],
      ["block people", () => safety.blockUser("u1")],
    ];
    for (const [action, run] of refused)
      await assert.rejects(run(), new RegExp(`can't ${action}`), action);
    assert.equal(
      JSON.stringify([mockPosts, mockBookings, mockOffers]),
      snapshot,
    );
    assert.equal(calls.length, 0);
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
  assert.match(calls[0].url.pathname, /functions\/v1\/place-autocomplete$/);
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

test("email delivery failures reject the request and explain restrictions and sender quotas", async () => {
  const { sendEmailOtp } = await import("../src/services/emailAuth");
  for (const [status, code, message, expected] of [
    [
      403,
      "email_address_not_authorized",
      "Email address not authorized",
      /delivery needs to be configured/,
    ],
    [
      429,
      "over_email_send_rate_limit",
      "Email rate limit exceeded",
      /sending limit.*Try again later/,
    ],
    [
      429,
      "over_request_rate_limit",
      "Request rate limit reached",
      /wait a minute/,
    ],
    [
      422,
      "email_provider_disabled",
      "Email logins are disabled",
      /Email sign-in is currently unavailable/,
    ],
    [
      500,
      "unexpected_failure",
      "Error sending magic link email",
      /couldn't send your email code/,
    ],
  ] as const) {
    responseStatus = status;
    handler = () => ({ code, msg: message });
    await assert.rejects(
      sendEmailOtp("person@example.com", "personal", undefined, false),
      expected,
    );
  }
});

test("eight-digit email verification sends the entire token, including a leading zero", async () => {
  const { verifyEmailOtp } = await import("../src/services/emailAuth");
  responseStatus = 403;
  handler = () => ({
    code: "otp_expired",
    msg: "Token has expired or is invalid",
  });
  await assert.rejects(
    verifyEmailOtp(" Person@Example.com ", " 01234567 "),
    /incorrect or expired/,
  );
  assert.match(calls[0].url.pathname, /auth\/v1\/verify$/);
  assert.equal(calls[0].body.email, "person@example.com");
  assert.equal(calls[0].body.token, "01234567");
  assert.equal(calls[0].body.type, "email");
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
  await assert.rejects(bookings.bookOffer("offer", "slot", 3), /1 or 2 people/);
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

test("conversation deletion uses the member RPC and surfaces errors", async () => {
  handler = () => null;
  await chat.deleteConversation("conv");
  assert.equal(calls[0].url.pathname, "/rest/v1/rpc/delete_my_conversation");
  assert.deepEqual(calls[0].body, { p_conversation_id: "conv" });
  responseStatus = 403;
  handler = () => ({ message: "not a conversation member" });
  await assert.rejects(
    chat.deleteConversation("private"),
    /not a conversation member/,
  );
});

test("conversation reports send the conversation target to the moderation RPC", async () => {
  const { reportContent } = await import("../src/services/safety");
  handler = () => "report-id";
  assert.equal(
    await reportContent(
      { kind: "conversation", id: "conv" },
      "harassment",
      "  Concern  ",
    ),
    "report-id",
  );
  assert.equal(calls[0].url.pathname, "/rest/v1/rpc/submit_content_report");
  assert.deepEqual(calls[0].body, {
    p_kind: "conversation",
    p_target: "conv",
    p_reason: "harassment",
    p_details: "Concern",
  });
});

test("Google predictions resolve only after selection and pass the same session without exposing a key", async () => {
  const { searchPlaces, resolvePlace } = await import("../src/services/places");
  const prediction = {
    provider: "google",
    id: "ChIJ_infopark",
    name: "Infopark",
    address: "Kakkanad",
    attributions: [{ label: "Google Maps", url: "https://maps.google.com/" }],
  };
  handler = () => ({ places: [prediction] });
  const sessionToken = "12345678-1234-4234-8234-123456789012";
  const suggestions = await searchPlaces("Infopark", { sessionToken });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.sessionToken, sessionToken);
  assert.equal(suggestions[0].latitude, undefined);
  handler = () => ({ place: { ...prediction, latitude: 10, longitude: 76 } });
  const selected = await resolvePlace(suggestions[0], { sessionToken });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].body.action, "resolve");
  assert.equal(calls[1].body.sessionToken, sessionToken);
  assert.equal(selected.latitude, 10);
  await resolvePlace(selected);
  assert.equal(calls.length, 2);
  handler = () => ({ place: { ...selected, id: "other" } });
  await assert.rejects(resolvePlace(prediction), /Could not read/);
});

test("Google address canonicalization is accepted only when the server binds it to the selected prediction", async () => {
  const { resolvePlace } = await import("../src/services/places");
  const prediction = {
    provider: "google",
    id: "selected-address-id",
    name: "Chosen address",
    address: "Kakkanad",
    attributions: [],
  };
  handler = () => ({
    requestedId: prediction.id,
    place: {
      ...prediction,
      id: "canonical-address-id",
      latitude: 10,
      longitude: 76,
    },
  });
  assert.equal((await resolvePlace(prediction)).id, "canonical-address-id");
  handler = () => ({
    requestedId: "a-different-selection",
    place: {
      ...prediction,
      id: "canonical-address-id",
      latitude: 10,
      longitude: 76,
    },
  });
  await assert.rejects(resolvePlace(prediction), /Could not read/);
});

test("external meeting spots are saved and moved; edits cannot strip the required place", async () => {
  let row: any = {
    id: "location-post",
    author_id: "host",
    author_name: "Host",
    approved_count: 0,
    status: "open",
    created_at: new Date().toISOString(),
  };
  handler = (url) => {
    const call = calls.at(-1)!;
    if (url.pathname.endsWith("/posts")) {
      Object.assign(row, call.body);
      return { ...row };
    }
    if (url.pathname.endsWith("/post_cards")) return { ...row };
    return [];
  };
  const created = await posts.createPost("host", {
    title: "Coffee with friends",
    description: "Join me for a friendly coffee",
    venueName: "Courtyard entrance",
    location: { source: "manual", latitude: 10, longitude: 76 },
    startsAt: new Date(Date.now() + 4 * 3600000).toISOString(),
    vacancies: 2,
    tags: [],
  });
  assert.equal(calls[0].body.venue_id, null);
  assert.equal(calls[0].body.location_lat, 10);
  assert.equal(created.location?.longitude, 76);
  const moved = await posts.updatePost(created.id, {
    location: { source: "manual", latitude: 11, longitude: 77 },
  });
  assert.equal(moved.location?.latitude, 11);
  await assert.rejects(
    posts.updatePost(created.id, { location: null, venueName: null }),
    /Select a meeting place/,
  );
  assert.equal(row.location_lat, 11);
});

test("nearby plans query coordinates even when no registered venues exist and preserve RPC distance", async () => {
  handler = (url) =>
    url.pathname.endsWith("/nearby_post_cards")
      ? [
          {
            id: "external",
            title: "Plan nearby",
            author_id: "host",
            author_name: "Host",
            starts_at: new Date(Date.now() + 4 * 3600000).toISOString(),
            vacancies: 2,
            tags: [],
            distance_km: 0.25,
            status: "open",
          },
        ]
      : [];
  const rows = await posts.listPosts({
    nearby: { latitude: 10, longitude: 76, radiusM: 5000 },
  });
  const request = calls.find((c) =>
    c.url.pathname.endsWith("/nearby_post_cards"),
  )!;
  assert.deepEqual(request.body, { p_lat: 10, p_lng: 76, p_radius_m: 5000 });
  assert.equal(rows[0].distanceKm, 0.25);
  assert.ok(!calls.some((c) => c.url.pathname.endsWith("/post_cards")));
  await assert.rejects(() =>
    posts.listPosts({
      nearby: { latitude: 100, longitude: 76, radiusM: 5000 },
    }),
  );
});

test("publishing without a confirmed meeting place is rejected before any network request", async () => {
  const draft = {
    title: "Coffee together",
    description: "Join me for a friendly coffee",
    startsAt: new Date(Date.now() + 4 * 3600000).toISOString(),
    vacancies: 2,
    tags: [],
  };
  await assert.rejects(
    () => posts.createPost("host", draft),
    /Select a meeting place/,
  );
  await assert.rejects(
    () =>
      posts.createPost("host", { ...draft, venueName: "A typed name only" }),
    /Select a meeting place/,
  );
  assert.equal(calls.length, 0);
});

test("plan group services use authenticated RPCs, retain retry keys and fetch bounded chronological messages", async () => {
  const groups = await import("../src/services/planGroups");
  handler = (url) =>
    url.pathname.endsWith("send_plan_group_message")
      ? {
          id: "message",
          seq: 2,
          sender_id: "me",
          sender_name: "Me",
          body: "See you soon",
          created_at: "2026-11-14T10:00:00Z",
        }
      : [];
  const message = await groups.sendPlanGroupMessage(
    "group",
    "me",
    " See you soon ",
    "stable-retry-key-1",
  );
  assert.equal(message.mine, true);
  assert.deepEqual(calls[0].body, {
    p_group_id: "group",
    p_body: "See you soon",
    p_client_key: "stable-retry-key-1",
  });
  assert.ok(!("sender_id" in calls[0].body));
  calls.length = 0;
  handler = () => [
    {
      id: "new",
      seq: 2,
      sender_id: "other",
      body: "New",
      created_at: "2026-11-14T10:00:00Z",
    },
    {
      id: "old",
      seq: 1,
      sender_id: "me",
      body: "Old",
      created_at: "2026-11-14T09:00:00Z",
    },
  ];
  assert.deepEqual(
    (await groups.listPlanGroupMessages("group", "me", 99)).map((m) => m.id),
    ["old", "new"],
  );
  assert.equal(calls[0].url.searchParams.get("seq"), "lt.99");
  assert.equal(calls[0].url.searchParams.get("limit"), "60");
  calls.length = 0;
  handler = () => null;
  await groups.leavePlanGroup("group", "forged-user-does-not-go-to-server");
  assert.deepEqual(calls[0].body, { p_group_id: "group" });
});

test("plan chat inbox sends a device timezone and uses only server-authorized groups", async () => {
  const groups = await import("../src/services/planGroups");
  handler = () => [
    {
      id: "g1",
      postId: "p1",
      name: "Movie night",
      planTitle: "Movie night",
      startsAt: "2027-01-01T18:00:00Z",
      memberCount: 3,
    },
  ];
  const result = await groups.listPlanGroups(
    "not-a-server-membership-parameter",
  );
  assert.equal(result[0].name, "Movie night");
  assert.equal(calls[0].url.pathname, "/rest/v1/rpc/list_my_plan_groups");
  assert.deepEqual(calls[0].body, {
    p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
});

test("host inbox requests are bounded, unexpired and scoped to the host's own posts", async () => {
  const requests = await import("../src/services/joinRequests");
  handler = () => [
    {
      id: "r1",
      post_id: "p1",
      requester_id: "u2",
      status: "pending",
      decline_count: 0,
      created_at: new Date().toISOString(),
      requester: { display_name: "Meera" },
      post: {
        title: "Movie night",
        starts_at: "2027-01-01T18:00:00Z",
        venue_name: "Cinema",
      },
    },
  ];
  const result = await requests.listPendingRequestsForHost("host");
  const url = calls[0].url;
  assert.equal(url.searchParams.get("post.author_id"), "eq.host");
  assert.equal(url.searchParams.get("limit"), "100");
  assert.equal(url.searchParams.get("status"), "eq.pending");
  assert.match(url.searchParams.get("post.starts_at")!, /^gt\./);
  assert.match(url.searchParams.get("post.or")!, /expires_at\.is\.null/);
  assert.equal(result[0].requesterName, "Meera");
  assert.equal(result[0].postTitle, "Movie night");
});

test("a join request sends a trimmed optional note and rejects one over 280 characters", async () => {
  const requests = await import("../src/services/joinRequests");
  const row = {
    id: "r1",
    post_id: "p1",
    requester_id: "u1",
    status: "pending",
    decline_count: 0,
    created_at: "2026-11-15T10:00:00Z",
    note: "I’ll bring the football",
    requester: { display_name: "Asha" },
  };
  handler = () => row;
  calls.length = 0;
  const sent = await requests.requestToJoin(
    "p1",
    "u1",
    "  I’ll bring the football  ",
  );
  const rpc = () =>
    calls.filter((c) => c.url.pathname.endsWith("/rpc/request_join")).at(-1);
  assert.deepEqual(rpc()?.body, {
    p_post_id: "p1",
    p_note: "I’ll bring the football",
  });
  assert.equal(sent.note, "I’ll bring the football");
  handler = () => ({ ...row, note: null });
  await requests.requestToJoin("p1", "u1", "   ");
  assert.deepEqual(rpc()?.body, { p_post_id: "p1" });
  calls.length = 0;
  await assert.rejects(
    requests.requestToJoin("p1", "u1", "x".repeat(281)),
    /280/,
  );
  assert.equal(rpc(), undefined);
});

test("a host's public profile reads only public columns", async () => {
  const profile = await import("../src/services/profile");
  handler = () => [
    {
      id: "h1",
      display_name: "Meera Iyer",
      avatar_url: "https://example.invalid/a.jpg",
      bio: "Morning runs and filter coffee.",
    },
  ];
  calls.length = 0;
  const host = await profile.getPublicProfile("h1");
  const read = calls.find((c) => c.url.pathname.endsWith("/profiles"));
  assert.equal(
    read?.url.searchParams.get("select"),
    "id,display_name,avatar_url,bio",
  );
  assert.equal(read?.url.searchParams.get("id"), "eq.h1");
  assert.deepEqual(host, {
    id: "h1",
    displayName: "Meera Iyer",
    avatarUrl: "https://example.invalid/a.jpg",
    bio: "Morning runs and filter coffee.",
  });
});
