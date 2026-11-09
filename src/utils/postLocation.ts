export type PostLocation = {
  latitude: number;
  longitude: number;
  source: "google" | "manual" | "geoapify" | "demo";
  placeId?: string;
};
export function validPostLocation(value: unknown): value is PostLocation {
  const p = value as PostLocation | null;
  return (
    !!p &&
    Number.isFinite(p.latitude) &&
    p.latitude >= -90 &&
    p.latitude <= 90 &&
    Number.isFinite(p.longitude) &&
    p.longitude >= -180 &&
    p.longitude <= 180 &&
    ["google", "manual", "geoapify", "demo"].includes(p.source) &&
    (p.source !== "google" ||
      (typeof p.placeId === "string" &&
        /^[A-Za-z0-9_-]{1,512}$/.test(p.placeId)))
  );
}
export function manualPostLocation(
  latitude: string,
  longitude: string,
): PostLocation | null {
  if (
    ![latitude, longitude].every((text) =>
      /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text.trim()),
    )
  )
    return null;
  const p: PostLocation = {
    latitude: Number(latitude),
    longitude: Number(longitude),
    source: "manual",
  };
  return validPostLocation(p) ? p : null;
}
export function postLocationPatch(location: PostLocation | null) {
  if (location && !validPostLocation(location))
    throw new Error("Choose a valid meeting location.");
  return {
    location_lat: location?.latitude ?? null,
    location_lng: location?.longitude ?? null,
    location_source: location?.source ?? null,
    location_place_id: location?.placeId ?? null,
  };
}
