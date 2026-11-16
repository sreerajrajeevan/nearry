import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { AppState } from "react-native";
import {
  PremiumPlanId,
  PremiumReason,
  PremiumSnapshot,
  PremiumStore,
  RestoreStatus,
  readPremiumExpiry,
  syncPremium,
} from "../services/premium";
import { createRevenueCatAdapter } from "../services/purchases";
import { getSupabase, isDemoMode } from "../services/supabase";
import { UpgradeSheet } from "../components/UpgradeSheet";
import { useAuth } from "./AuthContext";

type PremiumValue = {
  snapshot: PremiumSnapshot;
  isPremium: boolean;
  demo: boolean;
  showUpgrade: (reason: PremiumReason) => void;
  purchase: (id: PremiumPlanId) => Promise<"done" | "cancelled">;
  load: () => Promise<void>;
  restore: () => Promise<RestoreStatus>;
};
const Context = createContext<PremiumValue | null>(null);

/** Premium state for the signed-in personal account; absent in the business stack. */
export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const { profile, session, demoMode } = useAuth();
  const userId = profile?.id ?? session?.user.id ?? "";
  const demo = demoMode || isDemoMode();
  const store = useMemo(() => {
    const client = getSupabase();
    return new PremiumStore({
      adapter: demo ? null : createRevenueCatAdapter(),
      userId,
      demo,
      readExpiry: async () =>
        client && !demo && userId ? readPremiumExpiry(client, userId) : null,
      sync: async () => (client ? syncPremium(client) : null),
    });
  }, [userId, demo]);
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  useEffect(() => {
    void store.load().catch(() => {});
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void store.load().catch(() => {});
    });
    return () => sub.remove();
  }, [store]);
  const [reason, setReason] = useState<PremiumReason | null>(null);
  const showUpgrade = useCallback((next: PremiumReason) => setReason(next), []);
  const value = useMemo<PremiumValue>(
    () => ({
      snapshot,
      isPremium: snapshot.status === "premium",
      demo,
      showUpgrade,
      purchase: store.purchase,
      restore: store.restore,
      load: () => store.load().catch(() => {}),
    }),
    [snapshot, demo, showUpgrade, store],
  );
  return (
    <Context.Provider value={value}>
      {children}
      {reason && (
        <UpgradeSheet reason={reason} onClose={() => setReason(null)} />
      )}
    </Context.Provider>
  );
}

/** Null outside the provider (business stack): callers show no Premium UI. */
export const usePremium = () => useContext(Context);
