import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccountType } from '../navigation/types';
import {
  AuthUser,
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  signOut as serviceSignOut,
} from '../services/auth';

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  bootstrapping: boolean;
  /** Set after signup until onboarding completes; RootNavigator gates on it. */
  pendingOnboarding: AccountType | null;
  signIn: (email: string, password: string, accountType: AccountType) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, accountType: AccountType) => Promise<void>;
  signInGoogle: (accountType: AccountType) => Promise<void>;
  completeOnboarding: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);
const STORAGE_KEY = 'nearry.auth.user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [pendingOnboarding, setPendingOnboarding] = useState<AccountType | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setUser(JSON.parse(raw));
      } finally {
        setBootstrapping(false);
      }
    })();
  }, []);

  const persist = async (u: AuthUser | null) => {
    setUser(u);
    if (u) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else await AsyncStorage.removeItem(STORAGE_KEY);
  };

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      bootstrapping,
      pendingOnboarding,
      signIn: async (email, password, accountType) => {
        setLoading(true);
        try {
          await persist(await signInWithEmail(email, password, accountType));
          setPendingOnboarding(null);
        } finally {
          setLoading(false);
        }
      },
      signUp: async (email, password, displayName, accountType) => {
        setLoading(true);
        try {
          await persist(await signUpWithEmail(email, password, displayName, accountType));
          setPendingOnboarding(accountType);
        } finally {
          setLoading(false);
        }
      },
      signInGoogle: async (accountType) => {
        setLoading(true);
        try {
          await persist(await signInWithGoogle(accountType));
          // Treat Google as a returning-or-new user: onboard to be safe.
          setPendingOnboarding(accountType);
        } finally {
          setLoading(false);
        }
      },
      completeOnboarding: () => setPendingOnboarding(null),
      signOut: async () => {
        await serviceSignOut();
        setPendingOnboarding(null);
        await persist(null);
      },
    }),
    [user, loading, bootstrapping, pendingOnboarding],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
