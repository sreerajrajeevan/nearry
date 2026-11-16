import { useEffect, useState, useRef } from "react";
import { useIsFocused } from "@react-navigation/native";
import * as Crypto from "expo-crypto";
import { searchPlaces, PlaceSuggestion, PlaceBias } from "../services/places";

export function usePlaceSuggestions(
  query: string,
  bias?: PlaceBias | null,
  enabled = true,
) {
  const focused = useIsFocused();
  const [places, setPlaces] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const session = useRef<{ token: string; created: number } | null>(null);
  const endSession = () => {
    session.current = null;
  };
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const text = query.trim();
    setPlaces([]);
    setError("");
    setLoading(false);
    if (!enabled || !focused || text.length < 3) {
      endSession();
      return () => {
        active = false;
        controller.abort();
      };
    }
    if (!session.current || Date.now() - session.current.created > 150000)
      session.current = { token: Crypto.randomUUID(), created: Date.now() };
    const sessionToken = session.current.token;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const search = () =>
          searchPlaces(text, {
            bias: bias ?? undefined,
            sessionToken,
            signal: controller.signal,
          });
        let results;
        try {
          results = await search();
        } catch (first) {
          // Mobile data drops and cold servers are usually gone a moment
          // later: try once more quietly before showing an error.
          if (!active || !(first as { retryable?: boolean }).retryable)
            throw first;
          await new Promise((resolve) => setTimeout(resolve, 900));
          if (!active) return;
          results = await search();
        }
        if (active) setPlaces(results);
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Could not search places.");
      } finally {
        if (active) setLoading(false);
      }
      // Wait for a pause in typing: each search counts against the
      // project's daily Google quota.
    }, 700);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, bias?.latitude, bias?.longitude, enabled, focused, retry]);
  return {
    places,
    loading,
    error,
    sessionToken: session.current?.token,
    onSessionEnd: endSession,
    retry: () => setRetry((n) => n + 1),
  };
}
