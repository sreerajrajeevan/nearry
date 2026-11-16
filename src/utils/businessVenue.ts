/** An owner-supplied location, reviewed together with their business proof. */
export type BusinessVenueSubmission = {
  name: string;
  category: string;
  area: string;
  address: string;
  latitude: number;
  longitude: number;
  source: "device" | "manual";
};
export function businessVenueError(v: BusinessVenueSubmission): string | null {
  for (const [label, value, min, max] of [
    ["Venue name", v.name, 2, 120],
    ["Category", v.category, 2, 60],
    ["Area", v.area, 2, 120],
    ["Full address", v.address, 8, 500],
  ] as const) {
    if (
      typeof value !== "string" ||
      value.trim().length < min ||
      value.trim().length > max
    )
      return `${label} must be between ${min} and ${max} characters.`;
  }
  if (
    !Number.isFinite(v.latitude) ||
    Math.abs(v.latitude) > 90 ||
    !Number.isFinite(v.longitude) ||
    Math.abs(v.longitude) > 180
  )
    return "Set the exact venue location using your current location or coordinates.";
  if (!["device", "manual"].includes(v.source))
    return "Use your venue’s GPS location or enter its coordinates.";
  return null;
}
export type BusinessVenueState = {
  venue: {
    id: string;
    name: string;
    category: string;
    area: string;
    address?: string;
  } | null;
  submission: BusinessVenueSubmission | null;
};
