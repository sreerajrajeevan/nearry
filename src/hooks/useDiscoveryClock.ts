import { useCallback, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

/** Update day labels/filters at minute boundaries, on focus and on resume. */
export function useDiscoveryClock() {
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const tick = () => {
        if (timer) clearTimeout(timer);
        const current = new Date();
        setNow(current);
        // This includes local midnight without relying on a 24-hour day (DST).
        timer = setTimeout(tick, 60_000 - (current.getTime() % 60_000));
      };
      tick();
      const app = AppState.addEventListener("change", (state) => {
        if (state === "active") tick();
        else if (timer) clearTimeout(timer);
      });
      return () => {
        if (timer) clearTimeout(timer);
        app.remove();
      };
    }, []),
  );
  return now;
}
