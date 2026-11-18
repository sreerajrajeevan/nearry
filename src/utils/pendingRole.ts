export type PendingRole = "personal" | "business";
export function parsePendingRole(
  raw: string | null,
  now = Date.now(),
): PendingRole | null {
  try {
    const value = JSON.parse(raw ?? "null");
    return value &&
      (value.role === "personal" || value.role === "business") &&
      Number.isFinite(value.at) &&
      value.at <= now &&
      now - value.at < 3_600_000
      ? value.role
      : null;
  } catch {
    return null;
  }
}
