import type { Place, PlaceBias, PlaceProvider } from "./placeTypes.ts";
import { validPoint } from "./placeTypes.ts";
const attribution = [
  { label: "Powered by Geoapify", url: "https://www.geoapify.com/" },
  {
    label: "© OpenStreetMap contributors",
    url: "https://www.openstreetmap.org/copyright",
  },
];
export function mapGeoapifyResults(payload: unknown): Place[] {
  const results = (payload as { results?: unknown[] } | null)?.results;
  if (!Array.isArray(results)) throw new Error("Invalid place response");
  const places = new Map<string, Place>();
  for (const row of results) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const point = { latitude: r.lat as number, longitude: r.lon as number };
    if (
      !validPoint(point) ||
      typeof r.place_id !== "string" ||
      !r.place_id ||
      r.place_id.length > 512
    )
      continue;
    const name = [r.name, r.address_line1, r.formatted].find(
      (v) => typeof v === "string" && v.trim(),
    ) as string | undefined;
    if (!name) continue;
    const source = r.datasource as { attribution?: string } | undefined;
    const extra =
      typeof source?.attribution === "string" &&
      !attribution.some((a) => a.label === source.attribution)
        ? [{ label: source.attribution }]
        : [];
    places.set(r.place_id, {
      provider: "geoapify",
      id: r.place_id,
      name: name.slice(0, 200),
      address:
        typeof r.formatted === "string" ? r.formatted.slice(0, 500) : name,
      ...point,
      attributions: [...attribution, ...extra],
    });
  }
  return [...places.values()].slice(0, 5);
}
export function createGeoapifyProvider(
  apiKey: string,
  request: typeof fetch = fetch,
): PlaceProvider {
  return {
    id: "geoapify",
    async search(query: string, bias?: PlaceBias) {
      const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
      url.search = new URLSearchParams({
        text: query,
        format: "json",
        limit: "5",
        lang: "en",
        filter: "countrycode:in",
        apiKey,
      }).toString();
      if (bias)
        url.searchParams.set(
          "bias",
          `proximity:${bias.longitude},${bias.latitude}`,
        );
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await request(url, { signal: controller.signal });
        if (!response.ok) throw new Error("Place provider unavailable");
        return mapGeoapifyResults(await response.json());
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
