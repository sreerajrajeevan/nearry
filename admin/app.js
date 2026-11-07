import { createClient } from "@supabase/supabase-js";
const config = window.NEARRY_ADMIN_CONFIG;
const $ = (id) => document.getElementById(id);
const NAV = [
  ["overview", "Overview", "Your operations at a glance"],
  [
    "business",
    "Business reviews",
    "Check the business and its proof before deciding",
  ],
  [
    "selfies",
    "Selfie reviews",
    "Compare a private selfie with the submitted profile photo",
  ],
  ["reports", "Safety reports", "Review the full reported context"],
  ["users", "Accounts", "Members and account status"],
  ["plans", "Plans", "Posted activities"],
  ["offers", "Offers", "Business promotions"],
  ["bookings", "Bookings", "Reservations"],
  ["operations", "Operations", "Background queues — read only"],
  ["audit", "Decision history", "Who reviewed what and when"],
];
const safe = (value) =>
  String(value ?? "—").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const date = (value) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
const tag = (value) => '<span class="chip">' + safe(value) + "</span>";
const textCell = (value) =>
  '<td><span class="wrap">' + safe(value) + "</span></td>";
let client,
  section = "overview",
  offset = 0,
  session = null,
  role = "",
  currentRows = [],
  revision = 0,
  pendingRead;
let factorId,
  enrollment,
  actionBusy = false,
  bootstrapRun = 0;
function feedback(text = "", auth = false) {
  $(auth ? "auth-message" : "feedback").textContent = text;
}
function login() {
  revision++;
  pendingRead?.abort();
  session = null;
  role = "";
  currentRows = [];
  $("dashboard").hidden = true;
  $("mfa").hidden = true;
  $("signin").hidden = false;
  $("content").replaceChildren();
  closeDialog(true);
}
async function call(payload, signal) {
  const { data, error } = await client.auth.getSession();
  if (error || !data.session)
    throw new Error("Your session expired. Sign in again.");
  session = data.session;
  const res = await fetch(config.supabaseUrl + "/functions/v1/admin-console", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + session.access_token,
      apikey: config.publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) login();
    if (body.code === "mfa_required") {
      $("dashboard").hidden = true;
      $("mfa").hidden = false;
    }
    throw new Error(body.error || "Admin service unavailable. Please retry.");
  }
  return body;
}
async function bootstrap() {
  const run = ++bootstrapRun;
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!data.session) {
    login();
    return;
  }
  session = data.session;
  const me = await call({ action: "status" });
  if (run !== bootstrapRun) return;
  role = me.role;
  $("signin").hidden = true;
  $("operator").textContent =
    (session.user.email || "Administrator") + " · " + role;
  if (me.mfaRequired) {
    $("dashboard").hidden = true;
    $("mfa").hidden = false;
    await prepareMfa().catch(
      (error) => ($("mfa-message").textContent = error.message),
    );
    return;
  }
  $("mfa").hidden = true;
  $("dashboard").hidden = false;
  enrollment = null;
  factorId = null;
  $("mfa-qr").removeAttribute("src");
  $("mfa-secret").textContent = "";
  navigation();
  await load();
}
async function prepareMfa() {
  $("mfa-message").textContent = "Checking your authenticator…";
  const { data, error } = await client.auth.mfa.listFactors();
  if (error) throw error;
  const verified = data.totp.find((f) => f.status === "verified");
  if (verified) {
    factorId = verified.id;
    enrollment = null;
    $("mfa-enrollment").hidden = true;
    $("mfa-heading").textContent = "Verify your authenticator";
  } else {
    $("mfa-heading").textContent = "Protect your admin account";
    if (!enrollment) {
      // Only discard unfinished factors belonging to this dashboard, never a verified factor.
      for (const f of data.all.filter(
        (f) => f.status === "unverified" && f.friendly_name === "Nearry Admin",
      )) {
        const removed = await client.auth.mfa.unenroll({ factorId: f.id });
        if (removed.error) throw removed.error;
      }
      const result = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Nearry Admin",
        issuer: "Nearry",
      });
      if (result.error) throw result.error;
      enrollment = result.data;
      factorId = enrollment.id;
    }
    $("mfa-enrollment").hidden = false;
    const qr = enrollment.totp.qr_code;
    if (!qr.startsWith("data:image/svg+xml"))
      throw new Error(
        "Authenticator setup could not be displayed. Please retry.",
      );
    $("mfa-qr").src = qr;
    $("mfa-secret").textContent = enrollment.totp.secret;
  }
  $("mfa-message").textContent = "";
}
function navigation() {
  $("navigation").innerHTML = NAV.map(
    ([id, label]) =>
      '<button class="nav-item ' +
      (id === section ? "active" : "") +
      '" data-section="' +
      id +
      '" aria-current="' +
      (id === section ? "page" : "false") +
      '">' +
      safe(label) +
      "</button>",
  ).join("");
  const entry = NAV.find((n) => n[0] === section);
  $("section-title").textContent = entry[1];
  $("section-description").textContent = entry[2];
}
async function load() {
  const run = ++revision,
    requested = section,
    page = offset;
  pendingRead?.abort();
  pendingRead = new AbortController();
  $("refresh").disabled = true;
  $("content").setAttribute("aria-busy", "true");
  $("pagination").hidden = true;
  currentRows = [];
  $("content").innerHTML =
    '<div class="empty">Loading ' +
    safe(NAV.find((n) => n[0] === requested)[1].toLowerCase()) +
    "…</div>";
  feedback("");
  try {
    const res = await call(
      { action: "list", section: requested, offset: page },
      pendingRead.signal,
    );
    if (run !== revision || !session) return;
    currentRows = res.rows || [];
    if (requested === "overview") renderMetrics(res.metrics);
    else if (requested === "operations") renderOperations(res.operations);
    else renderTable(currentRows, requested);
    $("pagination").hidden =
      requested === "overview" || requested === "operations";
    $("page-label").textContent = "Page " + (1 + page / 25);
    $("previous").disabled = page === 0;
    $("next").disabled = !res.hasMore || page >= 5000;
    $("last-updated").textContent =
      "Updated " +
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch (error) {
    if (run !== revision || error.name === "AbortError") return;
    $("content").innerHTML =
      '<div class="empty">' +
      safe(error.message) +
      "<p>Use Refresh to try again.</p></div>";
  } finally {
    if (run === revision) {
      $("refresh").disabled = false;
      $("content").setAttribute("aria-busy", "false");
    }
  }
}
function table(headers, rows) {
  if (!rows.length)
    return '<div class="empty"><strong>All caught up.</strong><p>There are no items in this section.</p></div>';
  return (
    '<div class="table-wrap"><table><thead><tr>' +
    headers.map((h) => "<th>" + safe(h) + "</th>").join("") +
    "</tr></thead><tbody>" +
    rows.join("") +
    "</tbody></table></div>"
  );
}
function action(label, row, kind) {
  return (
    '<button class="action" data-action="' +
    safe(label) +
    '" data-kind="' +
    kind +
    '" data-id="' +
    safe(row.id) +
    '">' +
    safe(label) +
    "</button>"
  );
}
function renderMetrics(m) {
  const items = [
    ["Members", m.users],
    ["Plans", m.plans],
    ["Local offers", m.offers],
    ["Bookings", m.bookings],
    ["Open reports", m.openReports],
    ["Business reviews", m.pendingBusinessReviews],
    ["Selfie reviews", m.pendingSelfieReviews],
  ];
  $("content").innerHTML =
    '<div class="cards">' +
    items
      .map(
        ([label, value]) =>
          '<div class="metric"><span>' +
          safe(label) +
          "</span><strong>" +
          safe(value) +
          "</strong></div>",
      )
      .join("") +
    '</div><section class="panel welcome-panel"><p class="eyebrow">YOUR REVIEW DESK</p><h2>A little care keeps the neighbourhood running.</h2><p>Review business requests, optional selfie checks and safety reports. Every decision is recorded.</p><div class="actions"><button class="primary" data-section="business">Review businesses →</button><button class="secondary" data-section="selfies">Check selfies</button><button class="secondary" data-section="reports">Open reports</button></div></section>';
}
function renderTable(rows, view) {
  let headers, rendered;
  const row = (cells) => "<tr>" + cells + "</tr>";
  if (view === "business") {
    headers = ["Business", "Category / area", "Submitted", "Review"];
    rendered = rows.map((r) =>
      row(
        textCell(r.business_name || r.display_name) +
          textCell(
            [r.business_details?.category, r.business_details?.area]
              .filter(Boolean)
              .join(" · "),
          ) +
          textCell(date(r.created_at)) +
          "<td>" +
          action("Review request", r, "business") +
          "</td>",
      ),
    );
  } else if (view === "selfies") {
    headers = ["Member", "Submitted", "Review"];
    rendered = rows.map((r) =>
      row(
        textCell(r.display_name || "Nearry member") +
          textCell(date(r.submitted_at)) +
          "<td>" +
          action("Compare photos", r, "selfie") +
          "</td>",
      ),
    );
  } else if (view === "reports") {
    headers = ["Reason", "Subject", "Submitted", "Review"];
    rendered = rows.map((r) =>
      row(
        "<td>" +
          tag(r.reason) +
          "<br>" +
          safe(r.target_kind) +
          "</td>" +
          textCell(r.subject) +
          textCell(date(r.created_at)) +
          "<td>" +
          action("Review report", r, "report") +
          "</td>",
      ),
    );
  } else {
    const specs = {
      users: [
        ["Member", "Type", "Verification", "Status", "Joined"],
        (r) => [
          r.business_name || r.display_name,
          r.account_type,
          r.verification_status,
          r.deletion_requested_at
            ? "Deleting"
            : r.suspended_at
              ? "Suspended"
              : "Active",
          date(r.created_at),
        ],
      ],
      plans: [
        ["Plan", "Host", "When", "Audience", "Status"],
        (r) => [
          r.title,
          r.author_id,
          date(r.starts_at),
          r.gender_preference || "any",
          r.status,
        ],
      ],
      offers: [
        ["Offer", "Business", "Starts", "Ends", "Status"],
        (r) => [
          r.title,
          r.business_id,
          date(r.starts_at),
          date(r.ends_at),
          r.status,
        ],
      ],
      bookings: [
        ["Booking", "Customer", "Offer", "Slot", "Status"],
        (r) => [r.id, r.customer_id, r.offer_id, date(r.slot), r.status],
      ],
      audit: [
        ["Decision", "Administrator", "Record", "Reason", "When"],
        (r) => [r.action, r.actor_id, r.target_id, r.note, date(r.created_at)],
      ],
    };
    const spec = specs[view];
    headers = spec[0];
    rendered = rows.map((r) => row(spec[1](r).map(textCell).join("")));
  }
  $("content").innerHTML = table(headers, rendered);
}
function renderOperations(o) {
  $("content").innerHTML = [
    [
      "Account deletion queue",
      o.deletions,
      ["Account", "Attempts", "Last error"],
      (r) => [r.user_id, r.attempts, r.last_error],
    ],
    [
      "Pending file cleanup",
      o.media,
      ["Bucket", "File", "Attempts", "Last error"],
      (r) => [r.bucket, r.path, r.attempts, r.last_error],
    ],
    [
      "Pending push notifications",
      o.push,
      ["Job", "Attempts", "Last error"],
      (r) => [r.id, r.attempts, r.last_error],
    ],
  ]
    .map(
      ([name, rows, headers, values]) =>
        '<section class="panel"><h2>' +
        safe(name) +
        "</h2>" +
        table(
          headers,
          rows.map((r) => "<tr>" + values(r).map(textCell).join("") + "</tr>"),
        ) +
        "</section>",
    )
    .join("");
}
let selected = null,
  proofLoaded = false;
function closeDialog(force = false) {
  if (actionBusy && !force) return;
  selected = null;
  proofLoaded = false;
  $("review-dialog").close();
  $("proof-image").removeAttribute("src");
  $("proof-frame").removeAttribute("src");
  $("avatar-image").removeAttribute("src");
  $("avatar-image").hidden = true;
  $("avatar-comparison").hidden = true;
  $("proof-link").removeAttribute("href");
  $("dialog-message").textContent = "";
  $("report-evidence").textContent = "";
  $("review-details").textContent = "";
  $("review-note").value = "";
}
function openReview(id, kind) {
  const item = currentRows.find((r) => r.id === id);
  if (!item || actionBusy) return;
  selected = { ...item, kind };
  proofLoaded = false;
  $("dialog-title").textContent =
    kind === "business"
      ? item.business_name || item.display_name || "Business request"
      : kind === "selfie"
        ? "Selfie check · " + (item.display_name || "Nearry member")
        : "Safety report";
  $("review-note").value = "";
  $("proof-check").checked = false;
  $("business-review").hidden = !["business", "selfie"].includes(kind);
  $("report-review").hidden = kind !== "report";
  $("proof-image").hidden = true;
  $("proof-frame").hidden = true;
  $("proof-link").hidden = true;
  $("proof-image").removeAttribute("src");
  $("proof-frame").removeAttribute("src");
  $("avatar-image").removeAttribute("src");
  $("avatar-image").hidden = true;
  $("avatar-comparison").hidden = true;
  $("comparison-note").hidden = kind !== "selfie";
  $("selfie-label").hidden = kind !== "selfie";
  $("comparison").classList.toggle("photo-comparison", kind === "selfie");
  $("proof-check-label").textContent =
    kind === "selfie"
      ? "I compared both photos and they appear to show the same person."
      : "I reviewed this business and its supporting document.";
  $("view-proof").textContent =
    kind === "selfie" ? "Load comparison photos" : "Load private proof";
  $("proof-message").textContent =
    "The proof is private. Preview it before approving.";
  $("dialog-message").textContent = "";
  $("review-details").textContent =
    kind === "business"
      ? [
          item.display_name,
          item.business_details?.category,
          item.business_details?.area,
          "Submitted " + date(item.created_at),
        ]
          .filter(Boolean)
          .join(" · ")
      : kind === "selfie"
        ? "Submitted " + date(item.submitted_at)
        : "Subject: " +
          item.subject +
          " · " +
          item.target_kind +
          " · " +
          date(item.created_at);
  $("report-evidence").textContent = [item.reason, item.details, item.evidence]
    .filter(Boolean)
    .join("\n\n");
  document
    .querySelectorAll(".business-action")
    .forEach((b) => (b.hidden = kind !== "business"));
  document.querySelector("[data-decision=verified]").hidden = kind !== "selfie";
  document.querySelector("[data-decision=rejected]").hidden = ![
    "business",
    "selfie",
  ].includes(kind);
  document.querySelector("[data-decision=rejected]").textContent =
    kind === "selfie" ? "Ask for another selfie" : "Reject request";
  $("proof-image").alt =
    kind === "selfie"
      ? "Private submitted selfie"
      : "Business verification proof";
  document
    .querySelectorAll(".report-action")
    .forEach((b) => (b.hidden = kind !== "report"));
  $("suspend").hidden =
    kind !== "report" || role !== "owner" || !item.subject_user_id;
  document.querySelector("[data-decision=remove]").hidden =
    kind !== "report" || ["user", "conversation"].includes(item.target_kind);
  $("review-dialog").showModal();
}
async function viewProof() {
  const item = selected;
  if (!item || !["business", "selfie"].includes(item.kind)) return;
  $("proof-check").checked = false;
  proofLoaded = false;
  $("view-proof").disabled = true;
  $("proof-message").textContent = "Loading private proof…";
  try {
    const res = await call({ action: "proof", kind: item.kind, id: item.id });
    if (selected !== item) return;
    const url = new URL(res.url),
      base = new URL(config.supabaseUrl);
    if (
      url.origin !== base.origin ||
      !url.pathname.startsWith(
        "/storage/v1/object/sign/" +
          (item.kind === "selfie" ? "selfie_proofs" : "verification_docs") +
          "/",
      )
    )
      throw new Error("Invalid proof link.");
    if (item.kind === "selfie") {
      const avatar = new URL(res.avatarUrl);
      if (
        avatar.origin !== base.origin ||
        !avatar.pathname.startsWith("/storage/v1/object/public/avatars/")
      )
        throw new Error("Invalid comparison photo.");
      $("avatar-image").src = avatar.href;
      $("avatar-image").hidden = false;
      $("avatar-comparison").hidden = false;
    }
    const pdf = /\.pdf$/i.test(decodeURIComponent(url.pathname));
    const preview = $(pdf ? "proof-frame" : "proof-image");
    preview.src = res.url;
    preview.hidden = false;
    if (item.kind === "selfie") {
      await Promise.all([
        $("avatar-image").decode(),
        $("proof-image").decode(),
      ]);
      if (selected !== item) return;
    }
    proofLoaded = true;
    $("proof-link").href = res.url;
    $("proof-link").hidden = false;
    $("proof-message").textContent =
      "Private preview link expires in one minute. Reload it if needed.";
  } catch (error) {
    if (selected === item) $("proof-message").textContent = error.message;
  } finally {
    $("view-proof").disabled = false;
  }
}
async function decide(decision) {
  const item = selected;
  if (!item || actionBusy) return;
  const note = $("review-note").value.trim();
  if (["rejected", "remove", "suspend"].includes(decision) && !note) {
    $("dialog-message").textContent = "Please add a reason for this decision.";
    return;
  }
  if (
    ["approved", "verified"].includes(decision) &&
    (!proofLoaded || !$("proof-check").checked)
  ) {
    $("dialog-message").textContent =
      "Load the photos or document and confirm that you reviewed them.";
    return;
  }
  const labels = {
    approved: "Approve this business?",
    verified: "Mark these photos as checked?",
    rejected:
      item.kind === "selfie"
        ? "Request another selfie?"
        : "Reject this business request?",
    dismiss: "Dismiss this report?",
    remove: "Remove the reported content?",
    suspend: "Suspend the reported account?",
  };
  if (!confirm(labels[decision] + " This decision will be recorded.")) return;
  actionBusy = true;
  $("review-dialog")
    .querySelectorAll("button")
    .forEach((b) => (b.disabled = true));
  $("dialog-message").textContent = "Saving decision…";
  try {
    await call({
      action: "decide",
      kind: item.kind,
      id: item.id,
      decision,
      note,
    });
    actionBusy = false;
    closeDialog();
    await load();
    feedback("Decision saved. The review status has been updated.");
  } catch (error) {
    $("dialog-message").textContent = error.message;
  } finally {
    actionBusy = false;
    $("review-dialog")
      .querySelectorAll("button")
      .forEach((b) => (b.disabled = false));
  }
}
async function signout() {
  ++bootstrapRun;
  revision++;
  pendingRead?.abort();
  const result = await client.auth.signOut({ scope: "local" });
  login();
  if (result.error) feedback(result.error.message, true);
  $("otp").value = "";
  $("mfa-code").value = "";
  $("mfa-qr").removeAttribute("src");
  $("mfa-secret").textContent = "";
  enrollment = null;
  factorId = null;
}
async function start() {
  if (!config?.supabaseUrl || !config?.publishableKey)
    throw new Error("Admin configuration is missing.");
  client = createClient(config.supabaseUrl, config.publishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storageKey: "nearry-admin-auth",
    },
  });
  $("email-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("send-code");
    button.disabled = true;
    feedback("Requesting code…", true);
    try {
      const email = $("email").value.trim();
      const res = await client.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (res.error) throw res.error;
      $("email").readOnly = true;
      $("code-form").hidden = false;
      feedback("Check your inbox for the sign-in code.", true);
      $("otp").focus();
    } catch (error) {
      feedback(error.message, true);
    } finally {
      button.disabled = false;
    }
  });
  $("change-email").addEventListener("click", () => {
    $("email").readOnly = false;
    $("code-form").hidden = true;
    $("otp").value = "";
    $("email").focus();
  });
  $("code-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("verify-code");
    button.disabled = true;
    try {
      const token = $("otp").value.replace(/\s/g, "");
      if (!/^\d{6,10}$/.test(token))
        throw new Error("Enter the complete numeric email code.");
      const res = await client.auth.verifyOtp({
        email: $("email").value.trim(),
        token,
        type: "email",
      });
      if (res.error) throw res.error;
      $("otp").value = "";
      await bootstrap();
    } catch (error) {
      feedback(error.message, true);
    } finally {
      button.disabled = false;
    }
  });
  $("mfa-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("verify-mfa");
    button.disabled = true;
    try {
      const code = $("mfa-code").value.trim();
      if (!/^\d{6}$/.test(code))
        throw new Error("Enter the six-digit authenticator code.");
      const res = await client.auth.mfa.challengeAndVerify({ factorId, code });
      if (res.error) throw res.error;
      $("mfa-code").value = "";
      await bootstrap();
    } catch (error) {
      $("mfa-message").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  for (const id of ["signout", "mfa-signout"])
    $(id).addEventListener("click", signout);
  $("mfa-retry").addEventListener("click", () =>
    prepareMfa().catch((e) => ($("mfa-message").textContent = e.message)),
  );
  $("refresh").addEventListener("click", load);
  $("previous").addEventListener("click", () => {
    offset = Math.max(0, offset - 25);
    load();
  });
  $("next").addEventListener("click", () => {
    offset += 25;
    load();
  });
  document.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-section]");
    if (nav && !actionBusy) {
      section = nav.dataset.section;
      offset = 0;
      navigation();
      load();
      return;
    }
    const btn = event.target.closest("[data-action]");
    if (btn) openReview(btn.dataset.id, btn.dataset.kind);
    const decision = event.target.closest("[data-decision]");
    if (decision) void decide(decision.dataset.decision);
  });
  $("view-proof").addEventListener("click", viewProof);
  $("dialog-close").addEventListener("click", closeDialog);
  $("review-dialog").addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog();
  });
  client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") login();
  });
  document.addEventListener("visibilitychange", () => {
    if (
      !document.hidden &&
      session &&
      !$("dashboard").hidden &&
      !$("review-dialog").open
    )
      void load();
  });
  await bootstrap();
}
start().catch((error) => {
  if (client) login();
  else $("signin").hidden = false;
  feedback(error.message, true);
});
