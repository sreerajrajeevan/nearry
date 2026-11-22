import { distanceKm } from "../services/locationDistance";
import { formatDistance } from "./format";

export type Coordinates = { latitude: number; longitude: number };
export type DistanceOrigin = {
  kind: "device" | "area" | "saved" | "sample";
  point?: Coordinates;
  label?: string;
};
export type DistanceHint = { km?: number; origin?: DistanceOrigin };

export function validCoordinates(value: unknown): value is Coordinates {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<Coordinates>;
  return (
    typeof point.latitude === "number" &&
    Number.isFinite(point.latitude) &&
    Math.abs(point.latitude) <= 90 &&
    typeof point.longitude === "number" &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.longitude) <= 180
  );
}
export const validDistance = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

/** Never call a searched-area or saved-position distance a distance from the viewer. */
export function cardDistance(
  origin: DistanceOrigin | null | undefined,
  destination?: Coordinates,
  hint?: DistanceHint,
): { km: number; label: string } | undefined {
  let km: number | undefined,
    from = origin;
  if (
    origin?.kind !== "sample" &&
    validCoordinates(origin?.point) &&
    validCoordinates(destination)
  ) {
    km = distanceKm(origin.point, destination);
  } else if (validDistance(hint?.km) && hint.origin) {
    km = hint.km;
    from = hint.origin;
  }
  if (!validDistance(km) || !from) return undefined;
  const distance = km < 0.05 ? "under 50 m" : formatDistance(km);
  const label =
    from.kind === "sample"
      ? `Sample distance · ${formatDistance(km)}`
      : from.kind === "device"
        ? `${km < 0.05 ? "Nearby · " : "About "}${distance} away`
        : `About ${distance} from ${from.kind === "saved" ? "last location" : from.label?.trim() || "selected area"}`;
  return { km, label };
}
