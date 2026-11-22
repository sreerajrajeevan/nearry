/**
 * Everything a moderator needs to judge one safety report: who reported it,
 * who was reported (with their report history), and the reported item as it
 * is now, next to the snapshot taken when it was reported.
 *
 * Private chats are never browsed freely: a message report shows only the few
 * messages around the reported one, and a conversation report only its latest
 * messages, the same window the report snapshot already keeps.
 */
type Db = any;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Messages shown either side of a reported message. */
export const MESSAGE_WINDOW = 5;
/** Latest messages shown for a reported conversation. */
export const CONVERSATION_WINDOW = 20;
export const MESSAGE_KINDS = new Set([
  "message",
  "conversation",
  "plan_message",
]);

function checked<T>(result: {
  data: T;
  error?: { message: string } | null;
}): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

/** Only images stored publicly in this project's own Storage are shown. */
export function ownPublicImage(
  url: unknown,
  supabaseUrl?: string,
): string | null {
  if (typeof url !== "string" || !supabaseUrl) return null;
  try {
    const u = new URL(url),
      base = new URL(supabaseUrl);
    if (
      base.protocol !== "https:" ||
      u.origin !== base.origin ||
      u.username ||
      u.password ||
      !u.pathname.startsWith("/storage/v1/object/public/")
    )
      return null;
    return u.toString();
  } catch {
    return null;
  }
}

type ReportRow = {
  id: string;
  status: string;
  reason: string;
  target_kind: string;
  created_at: string;
};
function tally(rows: ReportRow[]) {
  return {
    total: rows.length,
    open: rows.filter((r) => r.status === "open").length,
    upheld: rows.filter((r) => r.status === "resolved").length,
    dismissed: rows.filter((r) => r.status === "dismissed").length,
  };
}

async function person(db: Db, id: string | null, excludeReport: string) {
  if (!id || !UUID.test(id)) return null;
  const p = checked<any>(
    await db
      .from("profiles")
      .select(
        "id,account_type,display_name,business_name,verification_status,created_at,suspended_at,deletion_requested_at",
      )
      .eq("id", id)
      .maybeSingle(),
  );
  if (!p) return { id, missing: true };
  let email: string | null = null;
  try {
    const { data } = await db.auth.admin.getUserById(id);
    email = data?.user?.email ?? null;
  } catch {
    email = null;
  }
  const cols = "id,status,reason,target_kind,created_at";
  const [filed, against] = await Promise.all([
    db
      .from("content_reports")
      .select(cols)
      .eq("reporter_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("content_reports")
      .select(cols)
      .eq("subject_user_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  const others = (checked<ReportRow[]>(against) ?? []).filter(
    (r) => r.id !== excludeReport,
  );
  return {
    ...p,
    email,
    reportsFiled: tally(checked<ReportRow[]>(filed) ?? []),
    otherReportsAgainst: tally(others),
    recentReportsAgainst: others.slice(0, 5),
  };
}

async function names(db: Db, ids: string[]) {
  const unique = [...new Set(ids.filter((id) => UUID.test(id)))];
  if (!unique.length) return new Map<string, string>();
  const rows = checked<any[]>(
    await db
      .from("profiles")
      .select("id,display_name,business_name,account_type")
      .in("id", unique),
  );
  return new Map(
    (rows ?? []).map((p) => [
      p.id,
      (p.account_type === "business" && p.business_name) ||
        p.display_name ||
        "Member",
    ]),
  );
}

type Msg = { id: string; sender_id: string; body: string; created_at: string };
async function thread(db: Db, rows: Msg[], reportedId?: string) {
  const who = await names(
    db,
    rows.map((m) => m.sender_id),
  );
  return rows.map((m) => ({
    id: m.id,
    senderId: m.sender_id,
    sender: who.get(m.sender_id) ?? "Removed account",
    body: m.body,
    at: m.created_at,
    reported: m.id === reportedId,
  }));
}

/** Messages just before and after a reported one, oldest first. */
async function around(
  db: Db,
  table: string,
  scope: [string, string],
  target: any,
  order: string,
) {
  const cols =
    table === "plan_group_messages"
      ? "id,sender_id,body,created_at,seq"
      : "id,sender_id,body,created_at";
  const [before, after] = await Promise.all([
    db
      .from(table)
      .select(cols)
      .eq(scope[0], scope[1])
      .lt(order, target[order])
      .order(order, { ascending: false })
      .limit(MESSAGE_WINDOW),
    db
      .from(table)
      .select(cols)
      .eq(scope[0], scope[1])
      .gt(order, target[order])
      .order(order, { ascending: true })
      .limit(MESSAGE_WINDOW),
  ]);
  return [
    ...(checked<Msg[]>(before) ?? []).reverse(),
    target,
    ...(checked<Msg[]>(after) ?? []),
  ];
}

async function postSummary(db: Db, id: string, supabaseUrl?: string) {
  const post = checked<any>(
    await db
      .from("posts")
      .select(
        "id,author_id,title,description,venue_name,starts_at,status,vacancies,gender_preference,cost_cents,created_at",
      )
      .eq("id", id)
      .maybeSingle(),
  );
  if (!post) return null;
  const [photos, joined] = await Promise.all([
    db
      .from("post_photos")
      .select("photo_url,sort_order")
      .eq("post_id", id)
      .order("sort_order", { ascending: true })
      .limit(6),
    db
      .from("join_requests")
      .select("id")
      .eq("post_id", id)
      .eq("status", "approved"),
  ]);
  return {
    title: post.title,
    body: post.description,
    fields: [
      ["When", post.starts_at],
      ["Where", post.venue_name],
      ["Status", post.status],
      ["Spots", post.vacancies],
      ["Joined", (checked<any[]>(joined) ?? []).length],
      ["Who can join", post.gender_preference || "Anyone"],
      ["Cost", post.cost_cents ? `₹${post.cost_cents / 100} / person` : "Free"],
      ["Posted", post.created_at],
    ],
    images: (checked<any[]>(photos) ?? [])
      .map((p) => ownPublicImage(p.photo_url, supabaseUrl))
      .filter(Boolean) as string[],
  };
}

async function content(
  db: Db,
  kind: string,
  id: string,
  supabaseUrl?: string,
): Promise<any> {
  if (kind === "post") return postSummary(db, id, supabaseUrl);
  if (kind === "photo") {
    const photo = checked<any>(
      await db
        .from("post_photos")
        .select("id,post_id,photo_url,created_at")
        .eq("id", id)
        .maybeSingle(),
    );
    if (!photo) return null;
    const post = await postSummary(db, photo.post_id, supabaseUrl);
    const image = ownPublicImage(photo.photo_url, supabaseUrl);
    return {
      title: post ? `Photo on “${post.title}”` : "Photo",
      body: post?.body,
      fields: post?.fields ?? [],
      // The reported photo first, then the plan's other photos for context.
      images: [image, ...(post?.images ?? []).filter((u) => u !== image)]
        .filter(Boolean)
        .slice(0, 6),
      reportedImage: image,
    };
  }
  if (kind === "offer") {
    const o = checked<any>(
      await db
        .from("offers")
        .select(
          "id,title,description,status,starts_at,ends_at,price_cents,discount_pct,cover_photo_url,created_at",
        )
        .eq("id", id)
        .maybeSingle(),
    );
    if (!o) return null;
    const image = ownPublicImage(o.cover_photo_url, supabaseUrl);
    return {
      title: o.title,
      body: o.description,
      fields: [
        ["Status", o.status],
        ["Runs", `${o.starts_at} → ${o.ends_at}`],
        [
          "Price",
          o.price_cents == null ? null : `₹${o.price_cents / 100} / person`,
        ],
        ["Discount", o.discount_pct == null ? null : `${o.discount_pct}%`],
        ["Created", o.created_at],
      ],
      images: image ? [image] : [],
    };
  }
  if (kind === "venue") {
    const v = checked<any>(
      await db
        .from("venues")
        .select("id,name,category,area,address,verified_at,created_at")
        .eq("id", id)
        .maybeSingle(),
    );
    if (!v) return null;
    return {
      title: v.name,
      fields: [
        ["Category", v.category],
        ["Area", v.area],
        ["Address", v.address],
        ["Verified", v.verified_at ? "Yes" : "No"],
      ],
      images: [],
    };
  }
  if (kind === "user")
    return { title: "The person’s account", fields: [], images: [] };
  if (kind === "message") {
    const m = checked<any>(
      await db
        .from("messages")
        .select("id,conversation_id,sender_id,body,created_at")
        .eq("id", id)
        .maybeSingle(),
    );
    if (!m) return null;
    const rows = await around(
      db,
      "messages",
      ["conversation_id", m.conversation_id],
      m,
      "created_at",
    );
    return {
      title: "Private chat message",
      fields: [["Sent", m.created_at]],
      images: [],
      messages: await thread(db, rows, m.id),
      messageNote: `The reported message with up to ${MESSAGE_WINDOW} messages either side.`,
    };
  }
  if (kind === "conversation") {
    const c = checked<any>(
      await db
        .from("conversations")
        .select("id,post_id,booking_id,created_at")
        .eq("id", id)
        .maybeSingle(),
    );
    if (!c) return null;
    const latest = checked<Msg[]>(
      await db
        .from("messages")
        .select("id,sender_id,body,created_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: false })
        .limit(CONVERSATION_WINDOW),
    );
    return {
      title: c.booking_id ? "Booking chat" : "Plan chat (private)",
      fields: [["Started", c.created_at]],
      images: [],
      messages: await thread(db, (latest ?? []).reverse()),
      messageNote: `The latest ${CONVERSATION_WINDOW} messages.`,
    };
  }
  if (kind === "plan_message") {
    const m = checked<any>(
      await db
        .from("plan_group_messages")
        .select("id,group_id,sender_id,body,created_at,seq")
        .eq("id", id)
        .maybeSingle(),
    );
    if (!m) return null;
    const group = checked<any>(
      await db
        .from("plan_groups")
        .select("id,name,post_id")
        .eq("id", m.group_id)
        .maybeSingle(),
    );
    const rows = await around(
      db,
      "plan_group_messages",
      ["group_id", m.group_id],
      m,
      "seq",
    );
    return {
      title: `Group chat message${group?.name ? ` in “${group.name}”` : ""}`,
      fields: [["Sent", m.created_at]],
      images: [],
      messages: await thread(db, rows, m.id),
      messageNote: `The reported message with up to ${MESSAGE_WINDOW} messages either side.`,
    };
  }
  return null;
}

export async function reportContext(db: Db, id: string, supabaseUrl?: string) {
  const report = checked<any>(
    await db
      .from("content_reports")
      .select(
        "id,reporter_id,subject_user_id,target_kind,target_id,reason,details,snapshot,status,created_at,reviewed_at,review_note",
      )
      .eq("id", id)
      .maybeSingle(),
  );
  if (!report) throw new Error("Review unavailable: report not found");
  const [reporter, subject, item, removed] = await Promise.all([
    person(db, report.reporter_id, report.id),
    person(db, report.subject_user_id, report.id),
    content(db, report.target_kind, report.target_id, supabaseUrl),
    db
      .from("removed_content")
      .select("removed_at")
      .eq("target_kind", report.target_kind)
      .eq("target_id", report.target_id)
      .maybeSingle(),
  ]);
  const { reporter_id: _r, ...rest } = report;
  return {
    report: rest,
    reporter,
    subject,
    content: {
      kind: report.target_kind,
      missing: !item,
      removedAt: checked<any>(removed)?.removed_at ?? null,
      ...(item ?? { title: null, fields: [], images: [] }),
    },
  };
}
