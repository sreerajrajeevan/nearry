import type {
  Place,
  PlaceBias,
  PlaceSuggestion,
  PlaceSuggestionProvider,
} from "./placeTypes.ts";
import { validPoint } from "./placeTypes.ts";
export const googleAttribution = [
  { label: "Google Maps", url: "https://maps.google.com/" },
];

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
    places.set(p.placeId, {
      provider: "google",
      id: p.placeId,
      name: name.slice(0, 200),
      address:
        typeof address === "string"
          ? address.slice(0, 500)
          : name.slice(0, 500),
      attributions: googleAttribution,
    });
  }
  return [...places.values()].slice(0, 5);
}
export function createGooglePlacesProvider(
  apiKey: string,
  request: typeof fetch = fetch,
): PlaceSuggestionProvider {
  async function call(url: string, init: RequestInit, fields: string) {
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
      if (!response.ok) throw new Error("Google place search unavailable");
      return await response.json();
    } finally {
      clearTimeout(timer);
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
            center: bias ?? { latitude: 10.007, longitude: 76.363 },
            radius: 50000,
          },
        },
      };
      return mapGooglePredictions(
        await call(
          "https://places.googleapis.com/v1/places:autocomplete",
          { method: "POST", body: JSON.stringify(body) },
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
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
