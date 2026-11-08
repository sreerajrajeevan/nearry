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

/** Predictions have no coordinates until the person selects one. */
export type PlaceSuggestion = Pick<
  Place,
  "provider" | "id" | "name" | "address" | "attributions"
> &
  Partial<PlaceBias>;
export function validSuggestion(value: unknown): value is PlaceSuggestion {
  const p = value as PlaceSuggestion | null;
  if (validPlace(value)) return true;
  return (
    !!p &&
    p.provider === "google" &&
    typeof p.id === "string" &&
    /^[A-Za-z0-9_-]{1,512}$/.test(p.id) &&
    typeof p.name === "string" &&
    p.name.trim().length > 0 &&
    p.name.length <= 200 &&
    typeof p.address === "string" &&
    p.address.length <= 500 &&
    p.latitude === undefined &&
    p.longitude === undefined &&
    Array.isArray(p.attributions) &&
    p.attributions.every(
      (a) =>
        typeof a.label === "string" &&
        (a.url === undefined || /^https:\/\//.test(a.url)),
    )
  );
}
export interface PlaceSuggestionProvider {
  readonly id: string;
  suggest(
    query: string,
    bias?: PlaceBias,
    sessionToken?: string,
  ): Promise<PlaceSuggestion[]>;
  resolve(suggestion: PlaceSuggestion, sessionToken?: string): Promise<Place>;
}
export const validPlaceSession = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{16,36}$/.test(value);
