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
    name: "Infopark",
    address: "Sample location · Kakkanad, Kochi",
    latitude: 10.007,
    longitude: 76.363,
    attributions: [],
  },
  {
    provider: "demo",
    id: "kakkanad",
    name: "Kakkanad",
    address: "Sample location · Kochi, Kerala",
    latitude: 10.0159,
    longitude: 76.3419,
    attributions: [],
  },
  {
    provider: "demo",
    id: "kochi",
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
        ...(options.bias ? { bias: options.bias } : {}),
        ...(options.sessionToken ? { sessionToken: options.sessionToken } : {}),
      },
      signal: options.signal,
    },
  );
  if (error) {
    let message = "Could not search places. Please try again.";
    try {
      const payload = await error.context?.json();
      if (typeof payload?.error === "string") message = payload.error;
    } catch {
      /* network/aborted request */
    }
    throw new Error(message);
  }
  if (
    !data ||
    !Array.isArray(data.places) ||
    !data.places.every(validSuggestion)
  )
    throw new Error("Could not read the place results. Please try again.");
  return data.places.slice(0, 5);
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
    data.place.id !== place.id
  )
    throw new Error("Could not read this place. Please search again.");
  return data.place;
}
