import type { NeedPost } from "../services/mappers";

export type PlanDateFilter = "all" | "today" | "weekend";

/** Local calendar boundaries, including this weekend when it is already Saturday/Sunday. */
export function matchesPlanDate(
  startsAt: string,
  filter: PlanDateFilter,
  now = new Date(),
) {
  if (filter === "all") return true;
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return false;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (filter === "weekend") {
    const day = start.getDay();
    start.setDate(start.getDate() + (day === 0 ? -1 : (6 - day + 7) % 7));
  }
  const end = new Date(start);
  end.setDate(end.getDate() + (filter === "weekend" ? 2 : 1));
  return date >= start && date < end;
}

export function planCost(post: Pick<NeedPost, "costCents">) {
  if (post.costCents == null) return "Cost not specified";
  return post.costCents === 0
    ? "Free to join"
    : `₹${(post.costCents / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })} / person`;
}
