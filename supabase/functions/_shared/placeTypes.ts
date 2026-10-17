/** App-facing contract: provider IDs are never Nearry venue IDs. */
export type PlaceAttribution = { label: string; url?: string };
export type Place = {
  provider: string;
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  attributions: PlaceAttribution[];
};
export type PlaceBias = { latitude: number; longitude: number };
export interface PlaceProvider {
  readonly id: string;
  search(query: string, bias?: PlaceBias): Promise<Place[]>;
}
export function validPoint(value: unknown): value is PlaceBias {
  const p = value as PlaceBias | null;
  return (
    !!p &&
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude) &&
    Math.abs(p.latitude) <= 90 &&
    Math.abs(p.longitude) <= 180
  );
}
export function validPlace(value: unknown): value is Place {
  const p = value as Place | null;
  return (
    validPoint(p) &&
    typeof p.provider === "string" &&
    typeof p.id === "string" &&
    !!p.id &&
    typeof p.name === "string" &&
    !!p.name &&
    typeof p.address === "string" &&
    Array.isArray(p.attributions) &&
    p.attributions.every(
      (a) =>
        typeof a.label === "string" &&
        (a.url === undefined || /^https:\/\//.test(a.url)),
    )
  );
}
