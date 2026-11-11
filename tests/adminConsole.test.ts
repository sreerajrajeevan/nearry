import { test } from "node:test";
import assert from "node:assert/strict";
import { createAdminConsoleHandler } from "../supabase/functions/_shared/adminConsole";
const user = "00000000-0000-0000-0000-000000000010",
  review = "00000000-0000-0000-0000-000000000011";
const origin = "https://admin.nearry.example";
function fixture(options: any = {}) {
  const calls: any[] = [],
    settings = {
      authenticated: true,
      member: true,
      role: "owner",
      aal: "aal2",
      confirmed: true,
      active: true,
      ...options,
    };
  const db: any = {
    auth: {
      getUser: async (token: string) => ({
        data: {
          user:
            settings.authenticated && token === "valid"
              ? {
                  id: user,
                  email_confirmed_at: settings.confirmed ? "2026-01-01" : null,
                }
              : null,
        },
        error: null,
      }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: settings.aal },
          error: null,
        }),
      },
      admin: {
        getUserById: async (id: string) => {
          if (settings.emailLookupFails) throw new Error("lookup failed");
          return {
            data: { user: { id, email: "cafe-owner@example.com" } },
            error: null,
          };
        },
      },
    },
    from: (table: string) => {
      const call: any = { table };
      calls.push(call);
      const result = () => {
        if (settings.fail)
          return {
            data: null,
            error: { message: "private SQL / secret storage path" },
          };
        if (table === "admin_console_members")
          return {
            data: settings.member ? { role: settings.role } : null,
            error: null,
          };
        if (table === "profiles" && call.single)
          return {
            data: {
              id: user,
              account_type: settings.selfie ? "personal" : "business",
              avatar_url: `https://project.supabase.co/storage/v1/object/public/avatars/${user}/avatar.jpg`,
              verification_status: "pending",
              verification_doc_path: user + "/proof.jpg",
              suspended_at: settings.active ? null : "2026-01-01",
              deletion_requested_at: null,
              ...(call.select.includes("account_type") ? settings.profile : {}),
            },
            error: null,
          };
        if (table === "personal_selfie_reviews")
          return {
            data: {
              user_id: user,
              submission_id: review,
              selfie_path: user + "/selfie-test.jpg",
              avatar_path: user + "/avatar.jpg",
              avatar_url_at_submission: `https://project.supabase.co/storage/v1/object/public/avatars/${user}/avatar.jpg`,
              status: "pending",
              submitted_at: new Date().toISOString(),
              ...settings.selfieReview,
            },
            error: null,
          };
        if (table === "account_deletion_jobs" && call.single)
          return { data: settings.deletionJob ?? null, error: null };
        if (table === "admin_console_audit")
          return { data: settings.auditRows ?? [], error: null };
        if (table === "content_reports")
          return { data: settings.reportRows ?? [], error: null };
        if (table === "verification_review_jobs")
          return {
            data: {
              id: review,
              user_id: user,
              document_path: user + "/proof.jpg",
              reviewed_at: null,
              ...settings.review,
            },
            error: null,
          };
        return { data: settings.rows ?? [], error: null };
      };
      const chain: any = {
        select: (v: string) => {
          call.select = v;
          return chain;
        },
        eq: (k: string, v: any) => {
          call[k] = v;
          return chain;
        },
        is: (k: string, v: any) => {
          call[k] = v;
          return chain;
        },
        in: () => chain,
        not: () => chain,
        order: () => chain,
        limit: () => chain,
        range: (from: number, to: number) => {
          call.range = [from, to];
          return chain;
        },
        maybeSingle: async () => {
          call.single = true;
          return result();
        },
        then: (yes: any, no: any) => Promise.resolve(result()).then(yes, no),
      };
      return chain;
    },
    rpc: async (name: string, args: any) => {
      calls.push({ rpc: name, args });
      return {
        data:
          name === "admin_console_overview"
            ? { users: 9, pendingBusinessReviews: 2 }
            : [
                  "admin_console_business_queue",
                  "admin_console_selfie_queue",
                ].includes(name)
              ? (settings.rows ?? [])
              : null,
        error: settings.rpcError ? { message: settings.rpcError } : null,
      };
    },
    storage: {
      from: (bucket: string) => ({
        createSignedUrl: async (path: string, expiry: number) => {
          calls.push({ bucket, path, expiry });
          return {
            data: {
              signedUrl:
                "https://project.supabase.co/storage/v1/object/sign/" +
                bucket +
                "/" +
                path +
                "?token=fake",
            },
            error: null,
          };
        },
      }),
    },
  };
  const handler = createAdminConsoleHandler(
    db,
    origin,
    "https://project.supabase.co",
  );
  return { db, calls, settings, handler };
}
function req(body: any, token = "valid", from = origin) {
  return new Request("https://example.supabase.co/functions/v1/admin-console", {
    method: "POST",
    headers: {
      Origin: from,
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
test("admin: missing origin configuration and unwanted origins fail before authentication", async () => {
  const f = fixture();
  assert.equal(
    (
      await createAdminConsoleHandler(
        f.db,
        undefined,
      )(req({ action: "status" }))
    ).status,
    503,
  );
  assert.equal(
    (
      await f.handler(
        req({ action: "status" }, "valid", "https://evil.example"),
      )
    ).status,
    403,
  );
  assert.equal(f.calls.length, 0);
  const preflight = await f.handler(
    new Request("https://example.supabase.co", {
      method: "OPTIONS",
      headers: { Origin: origin },
    }),
  );
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), origin);
});
test("admin: invalid/unconfirmed, unallowlisted and inactive users are denied", async () => {
  for (const options of [
    { authenticated: false },
    { confirmed: false },
    { member: false },
    { active: false },
    { role: "forged" },
  ]) {
    const f = fixture(options);
    const r = await f.handler(req({ action: "status" }));
    assert.ok([401, 403].includes(r.status));
    assert.equal(
      f.calls.some((c) => c.rpc),
      false,
    );
  }
});
test("admin: status permits MFA setup, every private operation requires a verified aal2 session", async () => {
  const f = fixture({ aal: "aal1" });
  const r = await f.handler(req({ action: "status" }));
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { role: "owner", mfaRequired: true });
  assert.equal(r.headers.get("Cache-Control"), "no-store");
  for (const payload of [
    { action: "list", section: "overview" },
    { action: "proof", id: review },
    {
      action: "decide",
      id: review,
      kind: "business",
      decision: "approved",
      note: "",
    },
  ]) {
    const denied = await f.handler(req(payload));
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).code, "mfa_required");
  }
  assert.equal(
    f.calls.some((c) => c.rpc || c.bucket),
    false,
  );
});
test("admin: membership is rechecked on each request and revocation takes effect immediately", async () => {
  const f = fixture();
  assert.equal((await f.handler(req({ action: "status" }))).status, 200);
  f.settings.member = false;
  assert.equal(
    (await f.handler(req({ action: "list", section: "overview" }))).status,
    403,
  );
});
test("admin: overview uses the actual schema through the service-only overview RPC", async () => {
  const f = fixture();
  const r = await f.handler(req({ action: "list", section: "overview" }));
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).metrics, {
    users: 9,
    pendingBusinessReviews: 2,
  });
  assert(f.calls.some((c) => c.rpc === "admin_console_overview"));
  assert.equal(
    f.calls.some((c) => c.table === "users"),
    false,
  );
});
test("admin: business queue includes details and uses one extra eligible row for pagination", async () => {
  const rows = Array.from({ length: 26 }, (_, i) => ({
    id: String(i),
    business_name: "Cafe " + i,
    business_details: { category: "cafe", area: "Kochi" },
  }));
  const f = fixture({ rows });
  const r = await f.handler(
    req({ action: "list", section: "business", offset: 25 }),
  );
  const b = await r.json();
  assert.equal(r.status, 200);
  assert.equal(b.rows.length, 25);
  assert.equal(b.hasMore, true);
  assert.equal(b.rows[0].business_details.area, "Kochi");
  assert.deepEqual(
    f.calls.find((c) => c.rpc === "admin_console_business_queue").args,
    { p_offset: 25, p_limit: 26 },
  );
  for (const offset of [-1, 0.5, 5001, "25"])
    assert.equal(
      (await f.handler(req({ action: "list", section: "business", offset })))
        .status,
      400,
    );
});
test("admin: private proofs must match the current pending active business and expire after 60 seconds", async () => {
  const f = fixture();
  assert.equal(
    (await f.handler(req({ action: "proof", id: review }))).status,
    200,
  );
  assert.deepEqual(
    f.calls.find((c) => c.bucket),
    { bucket: "verification_docs", path: user + "/proof.jpg", expiry: 60 },
  );
  for (const options of [
    { review: { reviewed_at: "2026-01-01" } },
    { review: { document_path: "other/proof.jpg" } },
    { profile: { verification_status: "verified" } },
    { profile: { account_type: "personal" } },
    { profile: { deletion_requested_at: "2026-01-01" } },
  ]) {
    const x = fixture(options);
    assert.equal(
      (await x.handler(req({ action: "proof", id: review }))).status,
      404,
    );
    assert.equal(
      x.calls.some((c) => c.bucket),
      false,
    );
  }
});
test("admin: moderators cannot suspend; decisions require valid IDs and rejection reasons", async () => {
  const f = fixture({ role: "moderator" });
  assert.equal(
    (
      await f.handler(
        req({
          action: "decide",
          kind: "report",
          id: review,
          decision: "suspend",
          note: "reason",
        }),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await f.handler(
        req({
          action: "decide",
          kind: "business",
          id: review,
          decision: "rejected",
          note: " ",
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await f.handler(
        req({
          action: "decide",
          kind: "business",
          id: review,
          decision: "suspend",
          note: "",
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await f.handler(
        req({
          action: "decide",
          kind: "business",
          id: "bad",
          decision: "approved",
          note: "",
        }),
      )
    ).status,
    400,
  );
  const ok = await f.handler(
    req({
      action: "decide",
      kind: "business",
      id: review,
      decision: "approved",
      note: " Checked ",
    }),
  );
  assert.equal(ok.status, 200);
  assert.deepEqual(f.calls.find((c) => c.rpc === "admin_console_decide").args, {
    p_actor: user,
    p_kind: "business",
    p_record_id: review,
    p_decision: "approved",
    p_note: "Checked",
  });
});
test("admin: server errors never expose private SQL, paths or credentials; malformed/large requests fail", async () => {
  const f = fixture({ rpcError: "secret SQL / private bucket path" });
  const r = await f.handler(req({ action: "list", section: "overview" }));
  assert.equal(r.status, 500);
  assert.doesNotMatch(await r.text(), /secret SQL|private bucket/);
  assert.equal(
    (
      await fixture().handler(
        req({ action: "status", padding: "x".repeat(17000) }),
      )
    ).status,
    413,
  );
  assert.equal((await fixture().handler(req([]))).status, 400);
});

test("admin: selfie queue is paged and MFA-protected; approvals use the exact submission version", async () => {
  const f = fixture({
    selfie: true,
    rows: Array.from({ length: 26 }, (_, i) => ({ id: String(i) })),
  });
  const response = await f.handler(
    req({ action: "list", section: "selfies", offset: 25 }),
  );
  assert.equal(response.status, 200);
  const list = await response.json();
  assert.equal(list.rows.length, 25);
  assert.equal(list.hasMore, true);
  assert.deepEqual(
    f.calls.find((c) => c.rpc === "admin_console_selfie_queue").args,
    { p_offset: 25, p_limit: 26 },
  );
  const proof = await f.handler(
    req({ action: "proof", kind: "selfie", id: review }),
  );
  assert.equal(proof.status, 200);
  const body = await proof.json();
  assert.match(body.url, /sign\/selfie_proofs\//);
  assert.match(body.avatarUrl, /public\/avatars\//);
  assert.equal(body.expiresIn, 60);
  assert.equal(JSON.stringify(body).includes("avatar_path"), false);
  assert.deepEqual(
    f.calls.find((c) => c.bucket),
    { bucket: "selfie_proofs", path: user + "/selfie-test.jpg", expiry: 60 },
  );
  const verdict = await f.handler(
    req({
      action: "decide",
      kind: "selfie",
      id: review,
      decision: "verified",
      note: "",
    }),
  );
  assert.equal(verdict.status, 200);
  assert.deepEqual(f.calls.find((c) => c.rpc === "admin_console_decide").args, {
    p_actor: user,
    p_kind: "selfie",
    p_record_id: review,
    p_decision: "verified",
    p_note: "",
  });
  for (const payload of [
    { action: "list", section: "selfies" },
    { action: "proof", kind: "selfie", id: review },
    {
      action: "decide",
      kind: "selfie",
      id: review,
      decision: "verified",
      note: "",
    },
  ]) {
    const blocked = fixture({ aal: "aal1", selfie: true });
    assert.equal((await blocked.handler(req(payload))).status, 403);
    assert.equal(
      blocked.calls.some(
        (c) => c.bucket || c.rpc || c.table === "personal_selfie_reviews",
      ),
      false,
    );
  }
});

test("admin: changed/expired selfies, inactive accounts and off-origin avatars cannot be previewed or approved", async () => {
  for (const changes of [
    { selfieReview: { submission_id: user } },
    { selfieReview: { status: "verified" } },
    { selfieReview: { submitted_at: "invalid" } },
    { selfieReview: { submitted_at: "2020-01-01" } },
    { selfieReview: { selfie_path: "another/selfie-test.jpg" } },
    { profile: { account_type: "business" } },
    { profile: { deletion_requested_at: "2026-01-01" } },
    { profile: { avatar_url: "https://evil.example/photo.jpg" } },
    { selfieReview: { avatar_path: "../../evil.jpg" } },
    {
      profile: {
        avatar_url: `https://evil.example/storage/v1/object/public/avatars/${user}/avatar.jpg`,
      },
      selfieReview: {
        avatar_url_at_submission: `https://evil.example/storage/v1/object/public/avatars/${user}/avatar.jpg`,
      },
    },
  ]) {
    for (const action of ["proof", "decide"]) {
      const f = fixture({ selfie: true, ...changes });
      const r = await f.handler(
        req({
          action,
          kind: "selfie",
          id: review,
          decision: "verified",
          note: "",
        }),
      );
      assert.equal(r.status, 409, JSON.stringify(changes));
      assert.equal(
        f.calls.some((c) => c.bucket || c.rpc === "admin_console_decide"),
        false,
      );
    }
  }
  const rejected = await fixture({ selfie: true }).handler(
    req({
      action: "decide",
      kind: "selfie",
      id: review,
      decision: "rejected",
      note: " ",
    }),
  );
  assert.equal(rejected.status, 400);
});

test("admin: business queue shows the applicant email; a failed lookup never breaks the queue", async () => {
  const rows = [
    {
      id: "0",
      user_id: user,
      business_name: "Cafe",
      business_details: { category: "cafe", area: "Kochi" },
    },
    { id: "1", business_name: "No owner", business_details: {} },
  ];
  const f = fixture({ rows });
  const r = await f.handler(req({ action: "list", section: "business" }));
  const b = await r.json();
  assert.equal(r.status, 200);
  assert.equal(b.rows[0].email, "cafe-owner@example.com");
  assert.equal(b.rows[1].email, null);
  const broken = fixture({ rows, emailLookupFails: true });
  const rb = await broken.handler(
    req({ action: "list", section: "business" }),
  );
  assert.equal(rb.status, 200);
  assert.equal((await rb.json()).rows[0].email, null);
});

test("admin: account detail shows email, suspension reason and pending deletion job", async () => {
  const f = fixture({
    profile: {
      suspended_at: "2026-01-02",
      deletion_requested_at: "2026-01-03",
      account_type: "business",
      business_name: "Cafe",
    },
    auditRows: [{ note: "Repeated spam", created_at: "2026-01-02" }],
    deletionJob: {
      user_id: user,
      requested_at: "2026-01-03",
      attempts: 2,
      next_attempt_at: "2026-01-04",
      last_error: null,
      prepared_at: null,
    },
  });
  const r = await f.handler(req({ action: "account", id: user }));
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.email, "cafe-owner@example.com");
  assert.equal(b.suspendReason, "Repeated spam");
  assert.equal(b.deletionJob.attempts, 2);
  assert.equal(b.account_type, "business");
  assert.equal(
    (await f.handler(req({ action: "account", id: "bad" }))).status,
    400,
  );
});

test("admin: account detail falls back to the report note when no direct suspend audit exists", async () => {
  const f = fixture({
    profile: { suspended_at: "2026-01-02" },
    auditRows: [],
    reportRows: [
      {
        id: review,
        review_note: "Harassment in messages",
        reviewed_at: "2026-01-02",
      },
    ],
  });
  const b = await (
    await f.handler(req({ action: "account", id: user }))
  ).json();
  assert.equal(b.suspendReason, "Harassment in messages");
});

test("admin: account actions are owner-only, need a reason and forward the exact decision", async () => {
  for (const decision of ["suspend", "unsuspend", "cancel-deletion"]) {
    const f = fixture();
    const r = await f.handler(
      req({
        action: "decide",
        kind: "account",
        id: user,
        decision,
        note: "Appeal reviewed",
      }),
    );
    assert.equal(r.status, 200, decision);
    assert.deepEqual(
      f.calls.find((c) => c.rpc === "admin_console_decide").args,
      {
        p_actor: user,
        p_kind: "account",
        p_record_id: user,
        p_decision: decision,
        p_note: "Appeal reviewed",
      },
    );
    const mod = fixture({ role: "moderator" });
    assert.equal(
      (
        await mod.handler(
          req({
            action: "decide",
            kind: "account",
            id: user,
            decision,
            note: "x",
          }),
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await fixture().handler(
          req({
            action: "decide",
            kind: "account",
            id: user,
            decision,
            note: " ",
          }),
        )
      ).status,
      400,
    );
  }
  assert.equal(
    (
      await fixture().handler(
        req({
          action: "decide",
          kind: "account",
          id: user,
          decision: "delete",
          note: "x",
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await fixture().handler(
        req({
          action: "decide",
          kind: "account",
          id: "bad",
          decision: "suspend",
          note: "x",
        }),
      )
    ).status,
    400,
  );
});

test("admin: users list accepts the status filters and rejects unknown ones", async () => {
  const f = fixture({ rows: [{ id: user, account_type: "personal" }] });
  for (const filter of ["all", "suspended", "deletion", "active"]) {
    const r = await f.handler(
      req({ action: "list", section: "users", filter }),
    );
    assert.equal(r.status, 200, filter);
  }
  assert.equal(
    (
      await f.handler(req({ action: "list", section: "users", filter: "banned" }))
    ).status,
    400,
  );
});
