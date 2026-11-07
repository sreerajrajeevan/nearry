import type { NeedPost } from "../services/mappers";
import { postCategory, type DiscoveryCategory } from "./discovery";

export type PlanDateFilter = "all" | "today" | "weekend";

/** Share one clock across all conditions; stale cached plans must not reappear. */
export function discoveryPlans(
  posts: NeedPost[],
  filters: {
    date: PlanDateFilter;
    category: DiscoveryCategory | null;
    freeOnly: boolean;
  },
  now = new Date(),
) {
  const timestamp = now.getTime();
  return posts.filter(
    (post) =>
      post.status === "open" &&
      new Date(post.startsAt).getTime() > timestamp &&
      (!post.expiresAt || new Date(post.expiresAt).getTime() > timestamp) &&
      (!filters.category || postCategory(post) === filters.category) &&
      matchesPlanDate(post.startsAt, filters.date, now) &&
      (!filters.freeOnly || post.costCents === 0),
  );
}

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
