import { useEffect, useState } from "react";
import { searchPlaces, Place, PlaceBias } from "../services/places";

export function usePlaceSuggestions(
  query: string,
  bias?: PlaceBias | null,
  enabled = true,
) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const text = query.trim();
    setPlaces([]);
    setError("");
    setLoading(false);
    if (!enabled || text.length < 3)
      return () => {
        active = false;
        controller.abort();
      };
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchPlaces(text, {
          bias: bias ?? undefined,
          signal: controller.signal,
        });
        if (active) setPlaces(results);
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Could not search places.");
      } finally {
        if (active) setLoading(false);
      }
    }, 450);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, bias?.latitude, bias?.longitude, enabled, retry]);
  return { places, loading, error, retry: () => setRetry((n) => n + 1) };
}
