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
        const results = await searchPlaces(text, {
          bias: bias ?? undefined,
          sessionToken,
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
