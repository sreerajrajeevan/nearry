import { useContext, useEffect, useState } from "react";
import { AppState } from "react-native";
import { NavigationContext } from "@react-navigation/native";
import { useReducedMotion } from "../store/MotionContext";

/** Stop decorative loops when their screen blurs, the app backgrounds, or motion is reduced. */
export function useMotionActive() {
  const navigation = useContext(NavigationContext);
  const reduced = useReducedMotion();
  const [focused, setFocused] = useState(() => navigation?.isFocused() ?? true);
  const [foreground, setForeground] = useState(
    () =>
      AppState.currentState !== "background" &&
      AppState.currentState !== "inactive",
  );
  useEffect(() => {
    setFocused(navigation?.isFocused() ?? true);
    const focus = navigation?.addListener("focus", () => setFocused(true));
    const blur = navigation?.addListener("blur", () => setFocused(false));
    const app = AppState.addEventListener("change", (state) =>
      setForeground(state === "active"),
    );
    return () => {
      focus?.();
      blur?.();
      app.remove();
    };
  }, [navigation]);
  return !reduced && focused && foreground;
}
