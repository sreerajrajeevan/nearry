import { AppState } from "react-native";
import { personalProfileReady } from "../utils/profileReadiness";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Profile } from "../services/mappers";
import {
  initialOnboardingDraft,
  onboardingResumeStep,
  type OnboardingDraft,
} from "../services/onboardingDrafts";
import {
  clearOnboardingPhotoFiles,
  onboardingDrafts,
} from "../services/localOnboardingDrafts";

/** The same draft is used by first signup and the later CompleteProfile route. */
export function useOnboardingDraft(
  profile: Profile | null,
  business: boolean,
  demo: boolean,
) {
  const id = profile?.id,
    role = business ? "business" : "personal";
  const scope = `${demo ? "demo" : id}:${role}`;
  const session = useMemo(
    () => (id && !demo ? onboardingDrafts.open(id, role) : null),
    [id, role, demo],
  );
  const [state, setState] = useState(() => ({
    scope,
    value: initialOnboardingDraft(profile),
    ready: !session,
  }));
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const paused = useRef(false);
  const ready = state.scope === scope && state.ready;
  const latest = useRef({ value: state.value, ready });
  latest.current = { value: state.value, ready };
  useEffect(() => {
    let active = true;
    paused.current = false;
    setError("");
    const seed = initialOnboardingDraft(profile);
    if (!session) {
      setState({ scope, value: seed, ready: true });
      return;
    }
    setState({ scope, value: seed, ready: false });
    void (
      (business ? profile?.onboardingCompleted : personalProfileReady(profile))
        ? Promise.resolve(null)
        : session.read()
    )
      .then(async (saved) => {
        if (!active) return;
        if (!saved && id) await clearOnboardingPhotoFiles(id).catch(() => {});
        if (!active) return;
        const value = saved ?? seed;
        setState({
          scope,
          value: {
            ...value,
            step: onboardingResumeStep(value, role, profile?.age),
          },
          ready: true,
        });
      })
      .catch(() => {
        if (active)
          setError("Could not restore your saved setup. Please retry.");
      });
    return () => {
      active = false;
      if (latest.current.ready && !paused.current)
        void session.save(latest.current.value).catch(() => {});
    };
    // Seed only when the account/route changes; profile refreshes must not reset typing.
  }, [session, scope, retry]);

  useEffect(() => {
    if (!ready || !session || paused.current) return;
    let active = true;
    const timer = setTimeout(() => {
      void session
        .save(state.value)
        .then((saved) => {
          if (active && saved) setError("");
        })
        .catch(() => {
          if (active)
            setError(
              "Could not save your progress on this device. Please try again before leaving.",
            );
        });
    }, 250);
    const app = AppState.addEventListener("change", (next) => {
      if (next !== "active" && !paused.current)
        void session.save(latest.current.value).catch(() => {});
    });
    return () => {
      active = false;
      clearTimeout(timer);
      app.remove();
    };
  }, [ready, state.value, session]);

  const change = useCallback(
    <K extends keyof OnboardingDraft>(
      key: K,
      next:
        | OnboardingDraft[K]
        | ((current: OnboardingDraft[K]) => OnboardingDraft[K]),
    ) => {
      setState((current) => ({
        ...current,
        value: {
          ...current.value,
          [key]:
            typeof next === "function"
              ? (next as (value: OnboardingDraft[K]) => OnboardingDraft[K])(
                  current.value[key],
                )
              : next,
        },
      }));
    },
    [],
  );
  const flush = async () => {
    if (!ready) throw new Error("Please wait for your saved setup to load.");
    if (session && !(await session.save(latest.current.value)))
      throw new Error("Your account changed. Please reopen profile setup.");
    setError("");
  };
  return {
    value: state.value,
    change,
    ready,
    error,
    flush,
    retry: () => setRetry((n) => n + 1),
    pause: () => {
      paused.current = true;
    },
    resume: () => {
      paused.current = false;
    },
  };
}
