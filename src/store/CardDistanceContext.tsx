import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";
import { getPositionIfAllowed } from "../services/location";
import { homeLocationKey, parseHomeLocation } from "../utils/homeLocation";
import { onboardingPreferences } from "../utils/onboarding";
import {
  cardDistance,
  validCoordinates,
  type Coordinates,
  type DistanceHint,
  type DistanceOrigin,
} from "../utils/cardDistance";
import {
  venueDestinations,
  type VenueDestination,
} from "../services/venueDestinations";

type ContextValue = {
  origin: DistanceOrigin | null;
  device: Coordinates | null;
  venues: ReadonlyMap<string, VenueDestination>;
  ensureVenue: (id: string) => void;
  selectArea: (origin: DistanceOrigin | null) => void;
  setDevice: (point: Coordinates) => void;
  refresh: () => void;
};
const Context = createContext<ContextValue | null>(null);

/** One foreground position per session/resume; no background tracking or automatic permission prompts. */
export function CardDistanceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, session, demoMode } = useAuth();
  const id = profile?.id ?? session?.user.id;
  const scope = `${demoMode ? "sample" : (id ?? "signed-out")}:${profile?.accountType ?? ""}`;
  const [state, setState] = useState<{
    scope: string;
    revision: number;
    device: Coordinates | null;
    area: DistanceOrigin | null;
    venues: Map<string, VenueDestination>;
  }>({ scope: "", revision: -1, device: null, area: null, venues: new Map() });
  const [revision, setRevision] = useState(0);
  const epoch = useRef(0),
    fallbackVersion = useRef(0),
    positionVersion = useRef(0);
  const pending = useRef(new Set<string>()),
    requested = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current =
    state.scope === scope && state.revision === revision ? state : null;
  const refresh = useCallback(() => {
    setRevision((n) => n + 1);
  }, []);
  useEffect(() => {
    const ticket = ++epoch.current;
    const seed = onboardingPreferences(profile?.onboardingPreferences).area;
    const area: DistanceOrigin | null = demoMode
      ? { kind: "sample" }
      : seed
        ? { kind: "area", point: seed, label: seed.label }
        : null;
    setState({ scope, revision, device: null, area, venues: new Map() });
    requested.current.clear();
    pending.current.clear();
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const fallbackTicket = ++fallbackVersion.current;
    const positionTicket = ++positionVersion.current;
    const active = () => epoch.current === ticket;
    if (id && !demoMode && profile?.accountType === "personal") {
      void AsyncStorage.getItem(homeLocationKey(id))
        .then((raw) => {
          if (!active() || fallbackVersion.current !== fallbackTicket) return;
          const saved = parseHomeLocation(raw).current;
          if (saved)
            setState((s) => ({
              ...s,
              area:
                saved.type === "place"
                  ? {
                      kind: "area",
                      point: saved.place,
                      label: saved.place.name,
                    }
                  : { kind: "saved", point: saved, label: "last location" },
            }));
        })
        .catch(() => {});
      if (AppState.currentState === "active")
        void getPositionIfAllowed()
          .then((point) => {
            if (active() && positionVersion.current === positionTicket)
              setState((s) => ({
                ...s,
                device: validCoordinates(point) ? point : null,
              }));
          })
          .catch(() => {});
    }
    return () => {
      ++epoch.current;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
    // A profile refresh must not reset a user-selected origin.
  }, [scope, revision]);
  useEffect(() => {
    const app = AppState.addEventListener("change", (next) => {
      if (next === "active") refresh();
      else {
        ++positionVersion.current;
        setState((s) => ({ ...s, device: null }));
      }
    });
    return () => app.remove();
  }, [refresh]);
  const ensureVenue = useCallback(
    (venueId: string) => {
      if (
        !current ||
        !id ||
        profile?.accountType !== "personal" ||
        requested.current.has(venueId)
      )
        return;
      requested.current.add(venueId);
      pending.current.add(venueId);
      if (timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        const ids = [...pending.current];
        pending.current.clear();
        const ticket = epoch.current;
        void venueDestinations(ids)
          .then((found) => {
            if (ticket !== epoch.current) return;
            setState((s) => ({
              ...s,
              venues: new Map([...s.venues, ...found]),
            }));
          })
          .catch(() => {}); // The place name remains usable when distance metadata is unavailable.
      }, 20);
    },
    [scope, revision, !!current],
  );
  const selectArea = useCallback(
    (area: DistanceOrigin | null) => {
      ++fallbackVersion.current;
      setState((s) => ({ ...s, scope, area }));
    },
    [scope],
  );
  useEffect(() => {
    const seed = onboardingPreferences(profile?.onboardingPreferences).area;
    if (current && !current.area && seed && !demoMode)
      selectArea({ kind: "area", point: seed, label: seed.label });
  }, [profile?.onboardingPreferences, !!current, selectArea]);
  const setDevice = useCallback(
    (device: Coordinates) => {
      if (!validCoordinates(device)) return;
      ++positionVersion.current;
      setState((s) => ({ ...s, scope, device }));
    },
    [scope],
  );
  const origin = demoMode
    ? { kind: "sample" as const }
    : current?.device
      ? { kind: "device" as const, point: current.device }
      : (current?.area ?? null);
  return (
    <Context.Provider
      value={{
        origin,
        device: current?.device ?? null,
        venues: current?.venues ?? new Map(),
        ensureVenue,
        selectArea,
        setDevice,
        refresh,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useCardDistanceOrigin = () => useContext(Context);
export function useCardDistance(
  venueId?: string,
  location?: Coordinates,
  hint?: DistanceHint,
) {
  const context = useContext(Context);
  useEffect(() => {
    if (venueId) context?.ensureVenue(venueId);
  }, [venueId, context?.ensureVenue]);
  const venue = venueId ? context?.venues.get(venueId) : undefined;
  const fallback = hint?.origin
    ? hint
    : context?.origin?.kind === "sample"
      ? { km: venue?.sampleKm, origin: context.origin }
      : undefined;
  return {
    ...cardDistance(
      context?.origin,
      validCoordinates(location) ? location : venue?.point,
      fallback,
    ),
    venueName: venue?.name,
  };
}
