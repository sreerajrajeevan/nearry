import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { AccountType } from '../navigation/types';
import { getSupabase, isSupabaseConfigured, setDemoMode } from '../services/supabase';
import { Profile, DbProfile, toProfile } from '../services/mappers';
import { sendEmailOtp, verifyEmailOtp, signInWithGoogle, signOut as serviceSignOut } from '../services/auth';

export type OnboardingData = {
  interests?: string[];
  businessName?: string;
  businessDetails?: Record<string, unknown>;
};

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  /** Explicit demo mode — mock data, clearly separated from real auth. */
  demoMode: boolean;
  bootstrapping: boolean;
  loading: boolean;
  /** Resolved account type: profile wins; demo falls back to its lane. */
  accountType: AccountType | null;
  /** True when a signed-in user still has onboarding to finish. */
  needsOnboarding: boolean;
  /** Kept for navigator compat: the lane to onboard, when needsOnboarding. */
  pendingOnboarding: AccountType | null;
  sendOtp: (email: string, accountType: AccountType, displayName?: string) => Promise<void>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  signInGoogle: (accountType: AccountType) => Promise<void>;
  signOut: () => Promise<void>;
  enterDemoMode: (accountType?: AccountType) => void;
  exitDemoMode: () => void;
  completeOnboarding: (data: OnboardingData) => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const DEMO_PROFILE: Profile = {
  id: 'demo-user',
  accountType: 'personal',
  displayName: 'Demo User',
  interests: ['Sports', 'Music'],
  businessDetails: {},
  verificationStatus: 'unverified',
  onboardingCompleted: true,
  createdAt: new Date().toISOString(),
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [demoMode, setDemo] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [loading, setLoading] = useState(false);

  const loadProfile = async (userId: string): Promise<Profile | null> => {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return toProfile(data as DbProfile);
  };

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setBootstrapping(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(data.session);
        if (data.session) {
          try {
            setProfile(await loadProfile(data.session.user.id));
          } catch {
            setProfile(null);
          }
        }
      } finally {
        if (mounted) setBootstrapping(false);
      }
    })();
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, next) => {
      if (!mounted) return;
      setSession(next);
      if (event === 'SIGNED_OUT' || !next) {
        setProfile(null);
        return;
      }
      try {
        setProfile(await loadProfile(next.user.id));
      } catch {
        setProfile(null);
      }
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const accountType: AccountType | null =
    demoMode ? DEMO_PROFILE.accountType : (profile?.accountType ?? null);
  const needsOnboarding = !demoMode && !!profile && !profile.onboardingCompleted;
  const pendingOnboarding: AccountType | null = needsOnboarding ? profile!.accountType : null;

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile: demoMode ? DEMO_PROFILE : profile,
      demoMode,
      bootstrapping,
      loading,
      accountType,
      needsOnboarding,
      pendingOnboarding,
      sendOtp: async (email, accountTypeArg, displayName) => {
        setLoading(true);
        try {
          await sendEmailOtp(email, accountTypeArg, displayName);
        } finally {
          setLoading(false);
        }
      },
      verifyOtp: async (email, code) => {
        setLoading(true);
        try {
          const userId = await verifyEmailOtp(email, code);
          // Session is set by the client; profile loads via the listener.
          // Load it eagerly so routing doesn't flash the wrong lane.
          const supabase = getSupabase();
          if (supabase) {
            const { data } = await supabase.auth.getSession();
            setSession(data.session);
            if (data.session) setProfile(await loadProfile(userId));
          }
        } finally {
          setLoading(false);
        }
      },
      signInGoogle: async (accountTypeArg) => {
        setLoading(true);
        try {
          const userId = await signInWithGoogle(accountTypeArg);
          const supabase = getSupabase();
          if (supabase) {
            const { data } = await supabase.auth.getSession();
            setSession(data.session);
            if (data.session) setProfile(await loadProfile(userId));
          }
        } finally {
          setLoading(false);
        }
      },
      signOut: async () => {
        setLoading(true);
        try {
          if (demoMode) {
            setDemo(false);
            setDemoMode(false);
          } else {
            await serviceSignOut();
          }
          setSession(null);
          setProfile(null);
        } finally {
          setLoading(false);
        }
      },
      enterDemoMode: (lane: AccountType = 'personal') => {
        DEMO_PROFILE.accountType = lane;
        setDemoMode(true);
        setDemo(true);
        setProfile(null);
        setSession(null);
      },
      exitDemoMode: () => {
        setDemo(false);
        setDemoMode(false);
      },
      completeOnboarding: async (data) => {
        const supabase = getSupabase();
        if (demoMode || !supabase || !profile) return;
        setLoading(true);
        try {
          const patch: Record<string, unknown> = {
            onboarding_completed: true,
            interests: data.interests ?? profile.interests,
          };
          if (data.businessName !== undefined) patch.business_name = data.businessName;
          if (data.businessDetails !== undefined) patch.business_details = data.businessDetails;
          const { error } = await supabase.from('profiles').update(patch).eq('id', profile.id);
          if (error) throw new Error(error.message);
          setProfile(await loadProfile(profile.id));
        } finally {
          setLoading(false);
        }
      },
      refreshProfile: async () => {
        const supabase = getSupabase();
        if (demoMode || !supabase || !session) return;
        setProfile(await loadProfile(session.user.id));
      },
    }),
    [session, profile, demoMode, bootstrapping, loading, accountType, needsOnboarding, pendingOnboarding],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
