import { isDemoMode, requireSupabase } from "../supabase";
import {
  validPlace,
  validSuggestion,
} from "../../../supabase/functions/_shared/placeTypes";
export { validPlace } from "../../../supabase/functions/_shared/placeTypes";
export type {
  Place,
  PlaceBias,
  PlaceAttribution,
  PlaceKind,
  PlaceSuggestion,
} from "../../../supabase/functions/_shared/placeTypes";
import type {
  Place,
  PlaceBias,
  PlaceSuggestion,
} from "../../../supabase/functions/_shared/placeTypes";

const samples: Place[] = [
  {
    provider: "demo",
    id: "infopark",
    kind: "spot",
    name: "Infopark",
    address: "Sample location · Kakkanad, Kochi",
    latitude: 10.007,
    longitude: 76.363,
    attributions: [],
  },
  {
    provider: "demo",
    id: "kakkanad",
    kind: "area",
    name: "Kakkanad",
    address: "Sample location · Kochi, Kerala",
    latitude: 10.0159,
    longitude: 76.3419,
    attributions: [],
  },
  {
    provider: "demo",
    id: "kochi",
    kind: "city",
    name: "Kochi",
    address: "Sample location · Kerala",
    latitude: 9.9312,
    longitude: 76.2673,
    attributions: [],
  },
];
/** The UI knows only this contract. Provider keys and adapters stay on the server. */
export async function searchPlaces(
  query: string,
  options: {
    bias?: PlaceBias;
    signal?: AbortSignal;
    sessionToken?: string;
  } = {},
): Promise<PlaceSuggestion[]> {
  const text = query.trim();
  if (text.length < 3) return [];
  if (text.length > 120)
    throw new Error("Search for a place using up to 120 characters.");
  if (isDemoMode())
    return samples.filter((p) =>
      `${p.name} ${p.address}`.toLowerCase().includes(text.toLowerCase()),
    );
  const { data, error } = await requireSupabase().functions.invoke(
    "place-autocomplete",
    {
      body: {
        query: text,
        // Only the coordinates, whatever extra fields the caller's point has.
        ...(options.bias
          ? {
              bias: {
                latitude: options.bias.latitude,
                longitude: options.bias.longitude,
              },
            }
          : {}),
        ...(options.sessionToken ? { sessionToken: options.sessionToken } : {}),
      },
      signal: options.signal,
    },
  );
  if (error) throw await placeSearchError(error);
  if (
    !data ||
    !Array.isArray(data.places) ||
    !data.places.every(validSuggestion)
  )
    throw new Error("Could not read the place results. Please try again.");
  return data.places.slice(0, 5);
}

/**
 * A readable error for a failed place-search call. `retryable` marks the
 * passing kind (no signal, a busy or failed server) that is worth one quiet
 * retry before telling the person.
 */
export async function placeSearchError(error: {
  name?: string;
  context?: { status?: number; json?: () => Promise<any> };
}): Promise<Error & { retryable: boolean }> {
  if (error.name === "FunctionsFetchError")
    return Object.assign(
      new Error("Can’t reach place search. Check your internet and try again."),
      { retryable: true },
    );
  let message = "Could not search places. Please try again.";
  try {
    const payload = await error.context?.json?.();
    if (typeof payload?.error === "string") message = payload.error;
  } catch {
    /* no readable body */
  }
  const status = error.context?.status ?? 0;
  return Object.assign(new Error(message), {
    retryable: status === 0 || status >= 500,
  });
}

/** Resolve coordinates only for the chosen prediction; no details prefetch. */
export async function resolvePlace(
  place: PlaceSuggestion,
  options: { sessionToken?: string; signal?: AbortSignal } = {},
): Promise<Place> {
  if (!validSuggestion(place))
    throw new Error("Choose a place from the results.");
  if (validPlace(place)) return place;
  const { data, error } = await requireSupabase().functions.invoke(
    "place-autocomplete",
    {
      body: {
        action: "resolve",
        place,
        ...(options.sessionToken ? { sessionToken: options.sessionToken } : {}),
      },
      signal: options.signal,
    },
  );
  if (error) {
    let message = "Could not open this place. Please try again.";
    try {
      const payload = await error.context?.json();
      if (typeof payload?.error === "string") message = payload.error;
    } catch {}
    throw new Error(message);
  }
  if (
    !validPlace(data?.place) ||
    data.place.provider !== place.provider ||
    (data.place.id !== place.id &&
      !(place.provider === "google" && data.requestedId === place.id))
  )
    throw new Error("Could not read this place. Please search again.");
  return data.place;
}
