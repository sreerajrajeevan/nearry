export type Cursor = {
  at: string;
  id: string;
  startsAt?: string;
  distanceM?: number;
  spotlight?: boolean;
};
export type Page<T> = { items: T[]; cursor: Cursor | null };
export const pageSize = (n = 30) =>
  Math.min(80, Math.max(1, Math.floor(n) || 30));
export function parsePage(value: unknown): Page<Record<string, unknown>> {
  const p = value as Partial<Page<Record<string, unknown>>> | null;
  if (
    !p ||
    !Array.isArray(p.items) ||
    p.items.length > 80 ||
    p.items.some(
      (x) =>
        !x ||
        typeof x !== "object" ||
        Array.isArray(x) ||
        typeof x.id !== "string",
    )
  )
    throw new Error("Could not load this page. Please try again.");
  const c = p.cursor;
  if (
    c !== null &&
    c !== undefined &&
    (typeof c.at !== "string" ||
      !Number.isFinite(Date.parse(c.at)) ||
      typeof c.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        c.id,
      ) ||
      (c.startsAt !== undefined && !Number.isFinite(Date.parse(c.startsAt))) ||
      (c.distanceM !== undefined &&
        c.distanceM !== null &&
        (!Number.isFinite(c.distanceM) || c.distanceM < 0)) ||
      (c.spotlight !== undefined && typeof c.spotlight !== "boolean"))
  )
    throw new Error("Could not load the next page. Please refresh.");
  return { items: p.items, cursor: c ?? null };
}
export function mergePage<T extends { id: string }>(old: T[], next: T[]): T[] {
  const entries = new Map(old.map((x) => [x.id, x]));
  for (const item of next) entries.set(item.id, item);
  return [...entries.values()];
}
