const TTL = 60 * 60_000;
export type DeferredPlan = { id: string; at: number };
export function parseDeferredPlan(
  raw: string | null,
  now = Date.now(),
): DeferredPlan | null {
  try {
    const value = JSON.parse(raw ?? "null");
    return value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value.id,
      ) &&
      Number.isFinite(value.at) &&
      value.at <= now &&
      now - value.at < TTL
      ? value
      : null;
  } catch {
    return null;
  }
}
