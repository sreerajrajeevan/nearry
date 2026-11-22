import { useEffect, useRef } from "react";
import { Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { navigationRef } from "../navigation/navigationRef";
import { useAuth } from "../store/AuthContext";
import { planIdFromLink } from "../utils/shareLink";
import { parseDeferredPlan, DeferredPlan } from "../utils/deferredPlan";
import { Alert } from "../services/appAlert";
const KEY = "nearry.deferredPlan.v1";
/** Capture before login, then consume only once the personal navigator exists. */
export function usePlanLinks() {
  const auth = useAuth(),
    state = useRef(auth);
  state.current = auth;
  const pending = useRef<DeferredPlan | null>(null),
    revision = useRef(0),
    storage = useRef(Promise.resolve());
  const persist = (value: DeferredPlan | null) => {
    storage.current = storage.current
      .catch(() => {})
      .then(() =>
        value
          ? AsyncStorage.setItem(KEY, JSON.stringify(value))
          : AsyncStorage.removeItem(KEY),
      )
      .catch(() => {});
  };
  const go = useRef(() => {});
  go.current = () => {
    const a = state.current,
      p = pending.current;
    if (!p || !navigationRef.isReady()) return;
    if (!parseDeferredPlan(JSON.stringify(p))) {
      pending.current = null;
      persist(null);
      return;
    }
    if (
      !a.profile ||
      a.bootstrapping ||
      a.profileLoading ||
      !a.profile.roleSelected ||
      a.profile.suspendedAt ||
      a.profile.deletionRequestedAt
    )
      return;
    if (a.profile.accountType === "business") {
      pending.current = null;
      persist(null);
      Alert.alert(
        "A personal plan",
        "Open this shared plan with a Personal account.",
      );
      return;
    }
    if (!navigationRef.getRootState()?.routeNames.includes("PersonalApp"))
      return;
    pending.current = null;
    persist(null);
    navigationRef.navigate("PersonalApp", {
      screen: "PostDetails",
      params: { postId: p.id },
    });
  };
  useEffect(() => {
    let active = true;
    const capture = (url: string | null) => {
      const id = planIdFromLink(url);
      if (!active || !id) return;
      revision.current++;
      pending.current = { id, at: Date.now() };
      persist(pending.current);
      go.current();
    };
    const start = revision.current;
    void Promise.all([
      AsyncStorage.getItem(KEY).catch(() => null),
      Linking.getInitialURL().catch(() => null),
    ]).then(([raw, url]) => {
      if (!active || revision.current !== start) return;
      const id = planIdFromLink(url),
        saved = parseDeferredPlan(raw);
      pending.current = id ? { id, at: Date.now() } : saved;
      if (id) persist(pending.current);
      else if (raw && !saved) persist(null);
      go.current();
    });
    const link = Linking.addEventListener("url", ({ url }) => capture(url));
    const stop = navigationRef.addListener("state", () => go.current());
    const ready = navigationRef.addListener("ready", () => go.current());
    return () => {
      active = false;
      link.remove();
      stop();
      ready();
    };
  }, []);
  useEffect(() => {
    go.current();
  }, [
    auth.profile,
    auth.onboardingDeferred,
    auth.onboardingCelebration,
    auth.bootstrapping,
    auth.profileLoading,
  ]);
}
