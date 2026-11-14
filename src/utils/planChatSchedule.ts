export type ScheduledPlanChat = {
  id: string;
  startsAt?: string;
  durationMinutes?: number;
  cancelled?: boolean;
  lastAt?: string;
};
export type PlanChatSection = "today" | "upcoming" | "past" | "cancelled";
const MINUTE = 60_000;
function start(chat: ScheduledPlanChat) {
  return chat.startsAt ? new Date(chat.startsAt).getTime() : NaN;
}
function localDay(time: number) {
  const d = new Date(time);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
export function planChatSection(
  chat: ScheduledPlanChat,
  now: number,
): PlanChatSection {
  if (chat.cancelled) return "cancelled";
  const at = start(chat);
  if (localDay(at) === localDay(now)) return "today";
  // A plan that runs across midnight still belongs above future plans.
  if (at <= now && now < at + (chat.durationMinutes ?? 0) * MINUTE)
    return "today";
  return at > now ? "upcoming" : "past";
}
export function sortPlanChats<T extends ScheduledPlanChat>(
  chats: T[],
  now: number,
): T[] {
  const ranks = { today: 0, upcoming: 1, past: 2, cancelled: 3 };
  const ended = (c: T) => start(c) + (c.durationMinutes ?? 0) * MINUTE <= now;
  return [...chats].sort((a, b) => {
    const section = planChatSection(a, now),
      other = planChatSection(b, now);
    const rank = ranks[section] - ranks[other];
    if (rank) return rank;
    if (section === "today" && ended(a) !== ended(b)) return ended(a) ? 1 : -1;
    const dateDiff = start(a) - start(b);
    if (Number.isFinite(dateDiff) && dateDiff !== 0)
      return section === "past" || section === "cancelled"
        ? -dateDiff
        : dateDiff;
    const recent =
      new Date(b.lastAt ?? 0).getTime() - new Date(a.lastAt ?? 0).getTime();
    return (Number.isFinite(recent) && recent) || a.id.localeCompare(b.id);
  });
}
export function planChatTime(chat: ScheduledPlanChat, now: number): string {
  const at = start(chat);
  if (!Number.isFinite(at)) return "Plan time unavailable";
  const d = new Date(at),
    day = localDay(at),
    today = localDay(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const label =
    day === today
      ? "Today"
      : day === localDay(tomorrow.getTime())
        ? "Tomorrow"
        : d.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            ...(d.getFullYear() !== new Date(now).getFullYear()
              ? { year: "numeric" as const }
              : {}),
          });
  return `${label} · ${d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`;
}
/** In-app reminder only. It expires with the plan; no fictional push delivery. */
export function planChatReminder(
  chat: ScheduledPlanChat,
  title: string,
  now: number,
) {
  if (chat.cancelled) return null;
  const at = start(chat),
    delta = at - now;
  if (!Number.isFinite(at)) return null;
  if (delta <= 0) {
    if (now < at + (chat.durationMinutes ?? 0) * MINUTE)
      return {
        short: "Happening now",
        text: `Your plan “${title}” is happening now.`,
      };
    return null;
  }
  if (delta > 3 * 60 * MINUTE) return null;
  const minutes = Math.ceil(delta / MINUTE),
    h = Math.floor(minutes / 60),
    m = minutes % 60;
  const parts = [
    h ? `${h} ${h === 1 ? "hour" : "hours"}` : "",
    m ? `${m} ${m === 1 ? "minute" : "minutes"}` : "",
  ].filter(Boolean);
  const short = h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
  return {
    short: `In ${short}`,
    text: `Your plan “${title}” starts in ${parts.join(" ")}.`,
  };
}
