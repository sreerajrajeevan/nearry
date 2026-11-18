export type AvailableSlot = {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  seats_left: number;
};

/** Validate RPC rows before a picker maps them into interactive controls. */
export function isAvailableSlot(value: unknown): value is AvailableSlot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const slot = value as Partial<AvailableSlot>;
  return (
    typeof slot.id === "string" &&
    !!slot.id.trim() &&
    typeof slot.starts_at === "string" &&
    Number.isFinite(Date.parse(slot.starts_at)) &&
    typeof slot.ends_at === "string" &&
    Number.isFinite(Date.parse(slot.ends_at)) &&
    Date.parse(slot.ends_at) > Date.parse(slot.starts_at) &&
    typeof slot.capacity === "number" &&
    Number.isInteger(slot.capacity) &&
    slot.capacity >= 1 &&
    slot.capacity <= 500 &&
    typeof slot.seats_left === "number" &&
    Number.isInteger(slot.seats_left) &&
    slot.seats_left >= 0 &&
    slot.seats_left <= slot.capacity
  );
}
