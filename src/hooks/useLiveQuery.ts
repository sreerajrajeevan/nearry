import { useCallback, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

/** Focus-scoped data: stale accounts/screens and older responses cannot win. */
export function useLiveQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  subscribe?: (refresh: () => void) => () => void,
) {
  const [data, setData] = useState<T>();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const source = useRef({ key, fetcher, subscribe });
  source.current = { key, fetcher, subscribe };
  const focused = useRef(false),
    version = useRef(0);
  const lastKey = useRef<string | undefined>(undefined);
  const loadedKey = useRef<string | undefined>(undefined);
  const refresh = useCallback(async (silent = false) => {
    if (!focused.current) return;
    const ticket = ++version.current;
    const requested = source.current;
    const current = () =>
      focused.current &&
      ticket === version.current &&
      requested.key === source.current.key;
    if (!silent && loadedKey.current !== requested.key) setState("loading");
    setRefreshing(true);
    try {
      const result = await requested.fetcher();
      if (!current()) return;
      loadedKey.current = requested.key;
      setData(result);
      setError("");
      setState("ready");
    } catch (e) {
      if (current()) {
        setError(
          e instanceof Error ? e.message : "Check your connection and retry.",
        );
        setState("error");
      }
    } finally {
      if (current()) setRefreshing(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      if (lastKey.current !== key) {
        lastKey.current = key;
        loadedKey.current = undefined;
        setData(undefined);
      }
      void refresh();
      const reload = () => void refresh(true);
      const stop = source.current.subscribe?.(reload);
      const app = AppState.addEventListener("change", (state) => {
        if (state === "active") reload();
      });
      const timer = setInterval(reload, 30_000);
      return () => {
        focused.current = false;
        ++version.current;
        stop?.();
        app.remove();
        clearInterval(timer);
      };
    }, [key, refresh]),
  );
  return { data, state, error, refreshing, refresh };
}
