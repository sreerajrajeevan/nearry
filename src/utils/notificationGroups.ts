import type { IconName } from "../components/Icon";
import type { AppNotification } from "../services/mappers";

/**
 * How the notification centre sorts, labels and draws each notice: a category
 * for the filter chips, an icon and colour per type, and day sections.
 */
export type NotificationCategory =
  "plans" | "bookings" | "messages" | "account";
export type NotificationFilter =
  "all" | Exclude<NotificationCategory, "account">;

const CATEGORY: Record<string, NotificationCategory> = {
  join_request: "plans",
  nearby_plan: "plans",
  request_approved: "plans",
  request_declined: "plans",
  request_full: "plans",
  post_cancelled: "plans",
  plan_reminder: "plans",
  booking: "bookings",
  booking_confirmed: "bookings",
  booking_cancelled: "bookings",
  message: "messages",
  plan_group_message: "messages",
  verification_approved: "account",
  verification_rejected: "account",
  selfie_review: "account",
};

export function notificationCategory(kind: string): NotificationCategory {
  return CATEGORY[kind] ?? "account";
}

type Look = { icon: IconName; fg: string; bg: string };
// Icon colours are at least 4.5:1 on their soft background.
const GREEN = { fg: "#047857", bg: "#D1FAE5" };
const RED = { fg: "#B91C1C", bg: "#FEE2E2" };
const AMBER = { fg: "#B45309", bg: "#FEF3C7" };
const BLUE = { fg: "#1D4ED8", bg: "#DBEAFE" };
const VIOLET = { fg: "#6D28D9", bg: "#EDE9FE" };
const LOOK: Record<string, Look> = {
  join_request: { icon: "user-plus", ...AMBER },
  nearby_plan: { icon: "map-pin", ...AMBER },
  request_approved: { icon: "check-circle", ...GREEN },
  request_declined: { icon: "x-circle", ...RED },
  request_full: { icon: "users", ...AMBER },
  post_cancelled: { icon: "slash", ...RED },
  plan_reminder: { icon: "calendar", ...BLUE },
  booking: { icon: "calendar", ...AMBER },
  booking_confirmed: { icon: "calendar", ...GREEN },
  booking_cancelled: { icon: "calendar", ...RED },
  message: { icon: "message-circle", ...BLUE },
  plan_group_message: { icon: "message-square", ...BLUE },
  verification_approved: { icon: "shield", ...GREEN },
  verification_rejected: { icon: "alert-circle", ...RED },
  selfie_review: { icon: "user-check", ...VIOLET },
};

export function notificationLook(kind: string): Look {
  return LOOK[kind] ?? { icon: "bell", ...AMBER };
}

export function filtersFor(
  role: "personal" | "business",
): { key: NotificationFilter; label: string }[] {
  return role === "business"
    ? [
        { key: "all", label: "All" },
        { key: "bookings", label: "Bookings" },
        { key: "messages", label: "Messages" },
      ]
    : [
        { key: "all", label: "All" },
        { key: "plans", label: "Plans" },
        { key: "bookings", label: "Bookings" },
        { key: "messages", label: "Messages" },
      ];
}

export function filterNotifications(
  items: AppNotification[],
  filter: NotificationFilter,
): AppNotification[] {
  return filter === "all"
    ? items
    : items.filter((n) => notificationCategory(n.kind) === filter);
}

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const DAY = 24 * 60 * 60 * 1000;

type SectionKey = "today" | "yesterday" | "week" | "earlier";
const TITLES: Record<SectionKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "This week",
  earlier: "Earlier",
};

function sectionOf(iso: string, now: Date): SectionKey {
  const day = startOfDay(new Date(iso)),
    today = startOfDay(now);
  // Round so a daylight-saving change can't shift a day.
  const daysAgo = Math.round((today - day) / DAY);
  if (daysAgo <= 0) return "today";
  if (daysAgo === 1) return "yesterday";
  if (daysAgo < 7) return "week";
  return "earlier";
}

/** Newest-first notices into day sections, keeping their order. */
export function groupNotificationsByDay(
  items: AppNotification[],
  now: Date,
): { key: SectionKey; title: string; data: AppNotification[] }[] {
  const order: SectionKey[] = ["today", "yesterday", "week", "earlier"];
  const buckets = new Map<SectionKey, AppNotification[]>();
  for (const item of items) {
    const key = sectionOf(item.createdAt, now);
    buckets.set(key, [...(buckets.get(key) ?? []), item]);
  }
  return order
    .filter((key) => buckets.has(key))
    .map((key) => ({ key, title: TITLES[key], data: buckets.get(key)! }));
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Short time for a row: "25m" today, "9:30 pm" yesterday, "Thu", "10 Nov". */
export function rowTime(iso: string, now: Date): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const section = sectionOf(iso, now);
  if (section === "today") {
    const mins = Math.max(
      0,
      Math.floor((now.getTime() - date.getTime()) / 60000),
    );
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h`;
  }
  if (section === "yesterday")
    return date
      .toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
      .toLowerCase();
  if (section === "week") return DAYS[date.getDay()];
  return `${date.getDate()} ${MONTHS[date.getMonth()]}${
    date.getFullYear() !== now.getFullYear() ? ` ${date.getFullYear()}` : ""
  }`;
}
