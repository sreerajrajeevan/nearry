import React, { createContext, useContext, useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

const MotionContext = createContext({ reduced: true, ready: false });
export const useMotionPreference = () => useContext(MotionContext);
export const useReducedMotion = () => useContext(MotionContext).reduced;

export function MotionProvider({ children }: { children: React.ReactNode }) {
  // Stay still until the device preference is known.
  const [preference, setPreference] = useState({ reduced: true, ready: false });
  useEffect(() => {
    let active = true;
    let eventSeen = false;
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (reduced) => {
        eventSeen = true;
        if (active) setPreference({ reduced, ready: true });
      },
    );
    const fallback = setTimeout(() => {
      if (active && !eventSeen)
        setPreference((current) =>
          current.ready ? current : { reduced: true, ready: true },
        );
    }, 1000);
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (active && !eventSeen) setPreference({ reduced, ready: true });
      })
      .catch(() => {
        if (active && !eventSeen) setPreference({ reduced: true, ready: true });
      });
    return () => {
      active = false;
      clearTimeout(fallback);
      listener.remove();
    };
  }, []);
  return (
    <MotionContext.Provider value={preference}>
      {children}
    </MotionContext.Provider>
  );
}
