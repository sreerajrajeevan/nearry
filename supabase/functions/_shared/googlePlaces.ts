import type {
  Place,
  PlaceBias,
  PlaceKind,
  PlaceSuggestion,
  PlaceSuggestionProvider,
} from "./placeTypes.ts";
import { validPlaceKind, validPoint } from "./placeTypes.ts";
export const googleAttribution = [
  { label: "Google Maps", url: "https://maps.google.com/" },
];

const CITY_TYPES = new Set([
  "locality",
  "postal_town",
  "colloquial_area",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "administrative_area_level_3",
  "country",
]);
const AREA_TYPES = new Set([
  "sublocality",
  "sublocality_level_1",
  "sublocality_level_2",
  "sublocality_level_3",
  "neighborhood",
  "postal_code",
  "route",
]);
/** City, area or a specific spot, from a prediction's Google place types. */
export function googlePlaceKind(types: unknown): PlaceKind | undefined {
  if (!Array.isArray(types) || !types.length) return undefined;
  const list = types.filter((t): t is string => typeof t === "string");
  if (list.some((t) => CITY_TYPES.has(t))) return "city";
  if (list.some((t) => AREA_TYPES.has(t))) return "area";
  return list.length ? "spot" : undefined;
}

export function mapGooglePredictions(payload: unknown): PlaceSuggestion[] {
  const suggestions = (payload as { suggestions?: unknown[] } | null)
    ?.suggestions;
  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    suggestions === undefined
  )
    return [];
  if (!Array.isArray(suggestions)) throw new Error("Invalid place response");
  const places = new Map<string, PlaceSuggestion>();
  for (const item of suggestions) {
    const p = (item as any)?.placePrediction;
    if (
      !p ||
      typeof p.placeId !== "string" ||
      !/^[A-Za-z0-9_-]{1,512}$/.test(p.placeId)
    )
      continue;
    const name = p.structuredFormat?.mainText?.text ?? p.text?.text;
    if (typeof name !== "string" || !name.trim()) continue;
    const address =
      p.structuredFormat?.secondaryText?.text ?? p.text?.text ?? name;
    const kind = googlePlaceKind(p.types);
    places.set(p.placeId, {
      provider: "google",
      id: p.placeId,
      name: name.slice(0, 200),
      address:
        typeof address === "string"
          ? address.slice(0, 500)
          : name.slice(0, 500),
      attributions: googleAttribution,
      ...(kind ? { kind } : {}),
    });
  }
  return [...places.values()].slice(0, 5);
}
export function createGooglePlacesProvider(
  apiKey: string,
  request: typeof fetch = fetch,
): PlaceSuggestionProvider {
  async function attempt(url: string, init: RequestInit, fields: string) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await request(url, {
        ...init,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": fields,
        },
      });
      if (!response.ok) {
        // Logged for the function logs: status and Google's reason only,
        // never the key or what the person typed.
        const reason = await response
          .json()
          .then((b: any) => b?.error?.status ?? b?.error?.message)
          .catch(() => undefined);
        console.error("Google Places error", response.status, reason ?? "");
        throw Object.assign(new Error("Google place search unavailable"), {
          retryable: response.status >= 500,
          // 429 = the project's Google quota is used up. Retrying only
          // burns more of it.
          quota: response.status === 429,
        });
      }
      return await response.json();
    } catch (error) {
      // A timeout or dropped connection is worth one more try.
      if ((error as { retryable?: boolean }).retryable === undefined)
        Object.assign(error as object, { retryable: true });
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  async function call(url: string, init: RequestInit, fields: string) {
    try {
      return await attempt(url, init, fields);
    } catch (error) {
      if (!(error as { retryable?: boolean }).retryable) throw error;
      await new Promise((resolve) => setTimeout(resolve, 300));
      return attempt(url, init, fields);
    }
  }
  return {
    id: "google",
    async suggest(query: string, bias?: PlaceBias, sessionToken?: string) {
      const body = {
        input: query,
        includedRegionCodes: ["in"],
        languageCode: "en",
        regionCode: "in",
        ...(sessionToken ? { sessionToken } : {}),
        // A fixed India bias avoids geolocating the Supabase worker's IP.
        locationBias: {
          circle: {
            // Only the coordinates: Google rejects any other field.
            center: bias
              ? { latitude: bias.latitude, longitude: bias.longitude }
              : { latitude: 10.007, longitude: 76.363 },
            radius: 50000,
          },
        },
      };
      return mapGooglePredictions(
        await call(
          "https://places.googleapis.com/v1/places:autocomplete",
          { method: "POST", body: JSON.stringify(body) },
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.types",
        ),
      );
    },
    async resolve(
      suggestion: PlaceSuggestion,
      sessionToken?: string,
    ): Promise<Place> {
      if (!/^[A-Za-z0-9_-]{1,512}$/.test(suggestion.id))
        throw new Error("Invalid place ID");
      const url = new URL(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(suggestion.id)}`,
      );
      url.searchParams.set("languageCode", "en");
      if (sessionToken) url.searchParams.set("sessionToken", sessionToken);
      const payload = await call(
        url.toString(),
        { method: "GET" },
        "id,location,formattedAddress,attributions",
      );
      if (
        typeof payload?.id !== "string" ||
        !/^[A-Za-z0-9_-]{1,512}$/.test(payload.id) ||
        !validPoint(payload?.location) ||
        typeof payload.formattedAddress !== "string"
      )
        throw new Error("Invalid place response");
      // The displayed name comes from the chosen prediction. Do not request
      // displayName, ratings or photos: those change the selected Details SKU.
      return {
        provider: "google",
        id: payload.id,
        name: suggestion.name,
        address: payload.formattedAddress.slice(0, 500),
        ...payload.location,
        ...(validPlaceKind(suggestion.kind) ? { kind: suggestion.kind } : {}),
        attributions: [
          ...googleAttribution,
          ...(Array.isArray(payload.attributions)
            ? payload.attributions.flatMap((item: any) =>
                typeof item?.provider === "string" && item.provider
                  ? [
                      {
                        label: item.provider,
                        ...(typeof item.providerUri === "string" &&
                        /^https:\/\//.test(item.providerUri)
                          ? { url: item.providerUri }
                          : {}),
                      },
                    ]
                  : [],
              )
            : []),
        ],
      };
    },
  };
}
