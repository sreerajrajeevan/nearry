import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Session } from "@supabase/supabase-js";
import { AccountType } from "../navigation/types";
import {
  getSupabase,
  configureAuthStorage,
  requireSupabase,
  setDemoMode,
} from "../services/supabase";
import { Profile, DbProfile, toProfile } from "../services/mappers";
import {
  sendEmailOtp,
  verifyEmailOtp,
  signInWithGoogle,
  completeOAuthCallback,
  signOut as serviceSignOut,
} from "../services/auth";
import { unregisterPushToken } from "../services/notifications";
import { POLICY_VERSION } from "../utils/legal";
import { acceptCurrentTerms, AGREEMENT_REQUIRED } from "../services/terms";
import { completePersonalProfile as savePersonalDetails } from "../services/profile";
import { RequestVersion } from "../utils/requestVersion";
import type { OnboardingPreferences } from "../utils/onboarding";
import { AccountChoiceStore } from "../services/accountChoice";
configureAuthStorage(AsyncStorage);
const accountChoices = new AccountChoiceStore(AsyncStorage);

export type OnboardingData = {
  termsAccepted?: boolean;
  interests?: string[];
  businessName?: string;
  businessDetails?: Record<string, unknown>;
  displayName?: string;
  preferences?: OnboardingPreferences;
  personalDetails?: {
    displayName: string;
    gender: "male" | "female" | "other";
    age: number;
  };
  celebrate?: boolean;
};
type AuthState = {
  session: Session | null;
  profile: Profile | null;
  demoMode: boolean;
  bootstrapping: boolean;
  loading: boolean;
  accountType: AccountType | null;
  needsOnboarding: boolean;
  onboardingDeferred: boolean;
  onboardingCelebration: boolean;
  deferOnboarding: () => void;
  dismissOnboarding: () => void;
  pendingOnboarding: AccountType | null;
  profileLoading: boolean;
  profileError: string;
  intendedRole: AccountType;
  /** Set when the login lane differed from the account's saved type. */
  roleMismatch: AccountType | null;
  clearRoleMismatch: () => void;
  sendOtp: (
    email: string,
    accountType: AccountType,
    displayName?: string,
    signup?: boolean,
  ) => Promise<void>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  signInGoogle: (accountType: AccountType) => Promise<void>;
  signOut: (localOnly?: boolean) => Promise<void>;
  enterDemoMode: (accountType?: AccountType) => void;
  exitDemoMode: () => void;
  completeOnboarding: (data: OnboardingData) => Promise<void>;
  refreshProfile: () => Promise<void>;
  savePersonalProfile: (
    input: Parameters<typeof savePersonalDetails>[0],
  ) => Promise<void>;
  selectAccountType: (role: AccountType) => Promise<void>;
};
const AuthContext = createContext<AuthState | null>(null);
const demoProfile: Profile = {
  id: "demo-user",
  accountType: "personal",
  displayName: "Demo User",
  interests: ["Sports", "Music"],
  businessDetails: {},
  verificationStatus: "unverified",
  onboardingCompleted: true,
  roleSelected: true,
  gender: "female",
  age: 25,
  termsVersion: POLICY_VERSION,
  createdAt: new Date().toISOString(),
};
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [profile, setProfile] = useState<Profile | null>(null);
  const [demoDetails, setDemoDetails] = useState<Partial<Profile>>({});
  const [demoMode, setDemo] = useState(false),
    [demoRole, setDemoRole] = useState<AccountType>("personal");
  const [bootstrapping, setBootstrapping] = useState(true),
    [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false),
    [profileError, setProfileError] = useState("");
  const [intendedRole, setIntendedRole] = useState<AccountType>("personal");
  const [roleMismatch, setRoleMismatch] = useState<AccountType | null>(null);
  const [onboardingDeferred, setOnboardingDeferred] = useState(false);
  const [onboardingCelebration, setOnboardingCelebration] = useState(false);
  // Mirrors intendedRole for the auth callback (which closes over first render).
  const intendedRoleRef = useRef<AccountType>("personal");
  // True only for a fresh SIGNED_IN, not session restore / token refresh.
  const freshLoginRef = useRef(false);
  const version = useRef(new RequestVersion()),
    mounted = useRef(true),
    demoRef = useRef(false),
    sessionRef = useRef<Session | null>(null);
  const profileRef = useRef<Profile | null>(null);
  const initialProfiles = useRef(new Map<string, Promise<Profile>>());
  const sessionEpoch = useRef(0);
  const actionPending = useRef(false);
  const errorText = (e: unknown) =>
    e instanceof Error
      ? e.message
      : "Could not load your account. Please retry.";
  async function hydrate(next: Session | null, throwOnError = false) {
    const ticket = version.current.next();
    if (sessionRef.current?.user.id !== next?.user.id) {
      sessionEpoch.current++;
      initialProfiles.current.clear();
    }
    const epoch = sessionEpoch.current;
    sessionRef.current = next;
    setSession(next);
    setProfileError("");
    if (!next) {
      setOnboardingDeferred(false);
      setOnboardingCelebration(false);
      freshLoginRef.current = false;
      setRoleMismatch(null);
      setBootstrapping(false);
      profileRef.current = null;
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    const alreadyLoaded = profileRef.current?.id === next.user.id;
    if (!alreadyLoaded) {
      profileRef.current = null;
      setProfile(null);
      setProfileLoading(true);
    }
    try {
      const readProfile = async () => {
        const { data, error } = await requireSupabase().rpc("get_my_profile");
        if (error) throw error;
        if (!data)
          throw new Error(
            "Your profile is missing. Ask the administrator to restore it, then retry.",
          );
        const saved = toProfile(data as DbProfile);
        if (saved.id !== next.user.id)
          throw new Error("Account changed. Please retry.");
        return saved;
      };
      const load = async () =>
        accountChoices.resolve(await readProfile(), next.user, {
          isCurrent: () =>
            mounted.current &&
            !demoRef.current &&
            sessionEpoch.current === epoch &&
            sessionRef.current?.user.id === next.user.id,
          select: async (role) => {
            const { error } = await requireSupabase().rpc(
              "select_account_type",
              {
                p_account_type: role,
              },
            );
            if (error) throw error;
          },
          read: readProfile,
        });
      // Supabase's SIGNED_IN event and the OAuth callback may arrive together.
      // Share the initial read + selection so neither can publish a stale,
      // unselected profile after the other has consumed the stored choice.
      let job = !alreadyLoaded
        ? initialProfiles.current.get(next.user.id)
        : undefined;
      if (!job) {
        job = load();
        if (!alreadyLoaded) initialProfiles.current.set(next.user.id, job);
      }
      let saved: Profile;
      try {
        saved = await job;
      } finally {
        if (initialProfiles.current.get(next.user.id) === job)
          initialProfiles.current.delete(next.user.id);
      }
      if (
        mounted.current &&
        version.current.current(ticket) &&
        !demoRef.current
      ) {
        profileRef.current = saved;
        setProfile(saved);
        // Existing account, fresh login, lane != saved type: tell the user
        // instead of silently landing them in the other app.
        if (
          freshLoginRef.current &&
          saved.roleSelected &&
          intendedRoleRef.current !== saved.accountType
        ) {
          setRoleMismatch(saved.accountType);
        } else if (freshLoginRef.current) {
          setRoleMismatch(null);
        }
        freshLoginRef.current = false;
      }
    } catch (e) {
      if (mounted.current && version.current.current(ticket)) {
        if (!alreadyLoaded) {
          profileRef.current = null;
          setProfile(null);
        }
        setProfileError(errorText(e));
      }
      if (throwOnError) throw e;
    } finally {
      if (mounted.current && version.current.current(ticket)) {
        setProfileLoading(false);
        setBootstrapping(false);
      }
    }
  }
  useEffect(() => {
    mounted.current = true;
    const roleRestored = AsyncStorage.getItem("nearry.pendingRole")
      .then((role) => {
        if (mounted.current && (role === "personal" || role === "business")) {
          intendedRoleRef.current = role;
          setIntendedRole(role);
        }
      })
      .catch(() => {});
    const db = getSupabase();
    if (!db) {
      setBootstrapping(false);
      return;
    }
    let alive = true;
    let eventSeen = false;
    let eventVersion = 0;
    const subscription = db.auth.onAuthStateChange((event, next) => {
      eventSeen = true;
      const eventTicket = ++eventVersion;
      // Run queries after the Supabase auth lock has been released.
      if (
        (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") &&
        next?.user.id &&
        next.user.id === profileRef.current?.id
      ) {
        sessionRef.current = next;
        setSession(next);
        return;
      }
      version.current.invalidate();
      if (event === "SIGNED_IN") freshLoginRef.current = true;
      setTimeout(async () => {
        await roleRestored;
        if (alive && eventTicket === eventVersion && !demoRef.current)
          void hydrate(next);
      }, 0);
    }).data.subscription;
    void db.auth
      .getSession()
      .then(async ({ data, error }) => {
        await roleRestored;
        if (!alive) return;
        if (error) {
          setProfileError(error.message);
          setBootstrapping(false);
          return;
        }
        if (!eventSeen && !demoRef.current)
          void hydrate(data.session).finally(() => {
            if (alive) setBootstrapping(false);
          });
      })
      .catch((e) => {
        if (alive) {
          setProfileError(errorText(e));
          setBootstrapping(false);
        }
      });
    const callback = async (url: string | null) => {
      if (!url) return;
      try {
        const userId = await completeOAuthCallback(url);
        await roleRestored;
        if (userId && alive && !demoRef.current)
          await refreshAuthenticatedProfile(userId);
      } catch (e) {
        if (alive) setProfileError(errorText(e));
      }
    };
    void Linking.getInitialURL().then(callback);
    const link = Linking.addEventListener(
      "url",
      ({ url }) => void callback(url),
    );
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") db.auth.startAutoRefresh();
      else db.auth.stopAutoRefresh();
    });
    if (AppState.currentState === "active") db.auth.startAutoRefresh();
    return () => {
      alive = false;
      mounted.current = false;
      version.current.invalidate();
      subscription.unsubscribe();
      link.remove();
      app.remove();
      db.auth.stopAutoRefresh();
    };
  }, []);
  async function remember(
    role: AccountType,
    flow: "email" | "google",
    email?: string,
  ) {
    setIntendedRole(role);
    intendedRoleRef.current = role;
    // Discard old pre-login consent intents from earlier app versions.
    // New consent is collected only on the final onboarding review screen.
    await AsyncStorage.removeItem("nearry.signupAgreement");
    await AsyncStorage.setItem("nearry.pendingRole", role);
    await accountChoices.begin(role, flow, email);
  }
  async function action(work: () => Promise<void>) {
    if (actionPending.current)
      throw new Error("Please wait for the current action to finish.");
    actionPending.current = true;
    setLoading(true);
    try {
      await work();
    } finally {
      actionPending.current = false;
      if (mounted.current) setLoading(false);
    }
  }
  async function refreshProfile() {
    if (!demoRef.current) await hydrate(sessionRef.current, true);
  }
  async function refreshAuthenticatedProfile(userId: string) {
    const { data, error } = await requireSupabase().auth.getSession();
    if (error) throw error;
    if (data.session?.user.id !== userId)
      throw new Error("Account changed. Please retry.");
    await hydrate(data.session, true);
  }
  async function selectAccountType(role: AccountType) {
    await action(async () => {
      const { error } = await requireSupabase().rpc("select_account_type", {
        p_account_type: role,
      });
      if (error) throw error;
      await refreshProfile();
    });
  }
  async function signOut(localOnly = false) {
    await action(async () => {
      if (!demoRef.current) {
        if (localOnly) {
          await requireSupabase()
            .auth.signOut({ scope: "local" })
            .catch(() => {});
          await AsyncStorage.removeItem("nearry.pushToken");
        } else {
          await unregisterPushToken();
          await serviceSignOut();
        }
      }
      version.current.invalidate();
      sessionEpoch.current++;
      initialProfiles.current.clear();
      demoRef.current = false;
      setRoleMismatch(null);
      setDemo(false);
      setOnboardingDeferred(false);
      setOnboardingCelebration(false);
      setDemoMode(false);
      sessionRef.current = null;
      profileRef.current = null;
      setSession(null);
      setProfile(null);
      setProfileError("");
      setProfileLoading(false);
      await AsyncStorage.removeItem("nearry.pendingRole");
      await AsyncStorage.removeItem("nearry.signupAgreement");
      await accountChoices.clear();
    });
  }
  function enterDemoMode(role: AccountType = "personal") {
    version.current.invalidate();
    sessionEpoch.current++;
    initialProfiles.current.clear();
    demoRef.current = true;
    setDemoDetails({});
    setDemoRole(role);
    setDemo(true);
    setDemoMode(true);
    setProfile(null);
    profileRef.current = null;
    setProfileError("");
    setProfileLoading(false);
    setOnboardingDeferred(false);
    setOnboardingCelebration(false);
  }
  async function completeOnboarding(data: OnboardingData) {
    await action(async () => {
      if (demoRef.current) {
        setDemoDetails((current) => ({
          ...current,
          ...data.personalDetails,
          interests: data.interests ?? current.interests,
          onboardingPreferences: data.preferences,
          onboardingCompleted: true,
        }));
        return;
      }
      const id = sessionRef.current?.user.id;
      if (!id || !profile) throw new Error("Sign in first.");
      if (profile.accountType === "personal" && data.personalDetails) {
        const { error } = await requireSupabase().rpc(
          "finish_personal_onboarding",
          {
            p_display_name: data.personalDetails.displayName,
            p_gender: data.personalDetails.gender,
            p_age: data.personalDetails.age,
            p_interests: data.interests ?? profile.interests,
            p_preferences: data.preferences ?? {},
            p_terms_accepted: data.termsAccepted === true,
          },
        );
        if (error) throw error;
        if (data.celebrate !== false) setOnboardingCelebration(true);
        await refreshProfile();
        return;
      }
      if (profile.termsVersion !== POLICY_VERSION) {
        if (!data.termsAccepted) throw new Error(AGREEMENT_REQUIRED);
        await acceptCurrentTerms(id);
      }
      const ticket = version.current.next();
      const patch: Record<string, unknown> = {
        onboarding_completed: true,
        interests: data.interests ?? profile.interests,
      };
      if (data.businessName !== undefined)
        patch.business_name = data.businessName;
      if (data.businessDetails !== undefined)
        patch.business_details = data.businessDetails;
      if (data.displayName !== undefined)
        patch.display_name = data.displayName.trim();
      if (data.preferences !== undefined)
        patch.onboarding_preferences = data.preferences;
      const { error } = await requireSupabase()
        .from("profiles")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
      if (data.celebrate !== false) setOnboardingCelebration(true);
      if (version.current.current(ticket) && sessionRef.current?.user.id === id)
        await refreshProfile();
    });
  }
  const resolved = useMemo(
    () =>
      demoMode
        ? {
            ...demoProfile,
            accountType: demoRole,
            ...(demoRole === "business"
              ? { businessName: "Studio Nine", displayName: "Studio Nine" }
              : {
                  displayName: "Sree",
                  interests: ["Football", "Coffee", "Walks"],
                  ...demoDetails,
                }),
          }
        : profile,
    [demoMode, demoRole, profile, demoDetails],
  );
  const accountType = resolved?.accountType ?? null;
  const needsOnboarding =
    !demoMode && !!profile && !profile.onboardingCompleted;
  return (
    <AuthContext.Provider
      value={{
        session,
        profile: resolved,
        demoMode,
        bootstrapping,
        loading,
        accountType,
        needsOnboarding,
        onboardingDeferred,
        onboardingCelebration,
        deferOnboarding: () => {
          if (accountType === "personal") setOnboardingDeferred(true);
        },
        dismissOnboarding: () => {
          setOnboardingCelebration(false);
          setOnboardingDeferred(true);
        },
        pendingOnboarding: needsOnboarding ? accountType : null,
        profileLoading,
        profileError,
        intendedRole,
        roleMismatch,
        clearRoleMismatch: () => setRoleMismatch(null),
        sendOtp: (email, role, name, signup = true) =>
          action(async () => {
            await remember(role, "email", email);
            try {
              await sendEmailOtp(email, role, name, signup);
            } catch (e) {
              await accountChoices.clear();
              await AsyncStorage.removeItem("nearry.pendingRole");
              throw e;
            }
          }),
        verifyOtp: (email, code) =>
          action(async () => {
            const userId = await verifyEmailOtp(email, code);
            await refreshAuthenticatedProfile(userId);
          }),
        signInGoogle: (role) =>
          action(async () => {
            await remember(role, "google");
            let authenticated = false;
            try {
              const userId = await signInWithGoogle(role);
              authenticated = !!userId;
              if (userId) await refreshAuthenticatedProfile(userId);
            } catch (e) {
              // Retain the choice if sign-in succeeded but profile loading failed;
              // Retry can finish setup without showing the account picker again.
              if (!authenticated && !sessionRef.current) {
                await accountChoices.clear();
                await AsyncStorage.removeItem("nearry.pendingRole");
              }
              throw e;
            }
          }),
        signOut,
        enterDemoMode,
        exitDemoMode: () => {
          demoRef.current = false;
          setDemo(false);
          setDemoMode(false);
          void refreshProfile();
        },
        completeOnboarding,
        refreshProfile,
        savePersonalProfile: (input) =>
          action(async () => {
            if (demoRef.current) {
              setDemoDetails({
                displayName: input.displayName,
                gender: input.gender,
                age: input.age,
                termsVersion: POLICY_VERSION,
                onboardingCompleted: true,
                roleSelected: true,
              });
              return;
            }
            await savePersonalDetails(input);
            await refreshProfile();
          }),
        selectAccountType,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be inside AuthProvider");
  return value;
}
