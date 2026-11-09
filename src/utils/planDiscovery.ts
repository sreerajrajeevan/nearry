import type { NeedPost } from "../services/mappers";
import { postCategory, type DiscoveryCategory } from "./discovery";

export type PlanDateFilter = "all" | "today" | "weekend";
export type PlanSort = "soonest" | "nearest" | "newest";
export type PlanAudience = "all" | "any" | "female" | "male";
export type PlanOptions = {
  category: DiscoveryCategory | null;
  freeOnly: boolean;
  audience: PlanAudience;
  maxDistanceKm: 2 | 5 | 10 | 25 | null;
  sort: PlanSort;
};
export const DEFAULT_PLAN_OPTIONS: PlanOptions = {
  category: null,
  freeOnly: false,
  audience: "all",
  maxDistanceKm: null,
  sort: "soonest",
};
export const PLAN_SORT_LABELS: Record<PlanSort, string> = {
  soonest: "Starting soon",
  nearest: "Nearest first",
  newest: "Newest posted",
};
export const PLAN_AUDIENCE_LABELS: Record<PlanAudience, string> = {
  all: "Any audience",
  any: "Everyone",
  female: "Women only",
  male: "Men only",
};
export type PlanDistances = ReadonlyMap<string, number | undefined>;

/** Unknown, negative and non-finite values must never imply a nearby location. */
export function planDistance(
  post: Pick<NeedPost, "venueId" | "distanceKm">,
  distances?: PlanDistances,
) {
  const distance =
    post.distanceKm ??
    (post.venueId ? distances?.get(post.venueId) : undefined);
  return distance != null && Number.isFinite(distance) && distance >= 0
    ? distance
    : undefined;
}

/** Share one clock across all conditions; stale cached plans must not reappear. */
export function discoveryPlans(
  posts: NeedPost[],
  filters: {
    date: PlanDateFilter;
    category: DiscoveryCategory | null;
    freeOnly: boolean;
    /** Home is for discovering other hosts; My Posts uses its own query. */
    excludeAuthorId?: string;
    audience?: PlanAudience;
    maxDistanceKm?: number | null;
    sort?: PlanSort;
    distances?: PlanDistances;
  },
  now = new Date(),
) {
  const timestamp = now.getTime();
  const visible = posts.filter(
    (post) =>
      (!filters.excludeAuthorId || post.authorId !== filters.excludeAuthorId) &&
      post.status === "open" &&
      new Date(post.startsAt).getTime() > timestamp &&
      (!post.expiresAt || new Date(post.expiresAt).getTime() > timestamp) &&
      (!filters.category || postCategory(post) === filters.category) &&
      (!filters.audience ||
        filters.audience === "all" ||
        (post.genderPreference ?? "any") === filters.audience) &&
      (filters.maxDistanceKm == null ||
        (planDistance(post, filters.distances) ?? Infinity) <=
          filters.maxDistanceKm) &&
      matchesPlanDate(post.startsAt, filters.date, now) &&
      (!filters.freeOnly || post.costCents === 0),
  );
  return visible.sort((a, b) => {
    const soonest =
      new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    if (filters.sort === "nearest") {
      const distance =
        (planDistance(a, filters.distances) ?? Infinity) -
        (planDistance(b, filters.distances) ?? Infinity);
      if (distance) return distance;
    }
    if (filters.sort === "newest") {
      const created = (value: string) => {
        const timestamp = Date.parse(value);
        return Number.isNaN(timestamp) ? -Infinity : timestamp;
      };
      const newest = created(b.createdAt) - created(a.createdAt);
      if (newest) return newest;
    }
    return soonest || a.id.localeCompare(b.id);
  });
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
