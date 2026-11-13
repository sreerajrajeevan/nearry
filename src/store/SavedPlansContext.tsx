import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SavedPlansStore } from "../services/savedPlans";
import { useAuth } from "./AuthContext";
const Context = createContext<{
  ids: readonly string[];
  status: "loading" | "ready" | "error";
  toggle: (id: string) => Promise<void>;
  reload: () => Promise<readonly string[]>;
} | null>(null);
export function SavedPlansProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, session } = useAuth();
  const accountId = profile?.id ?? session?.user.id ?? "signed-out";
  const store = useMemo(
    () => new SavedPlansStore(AsyncStorage, accountId),
    [accountId],
  );
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  useEffect(() => {
    void store.load().catch(() => {});
  }, [store]);
  return (
    <Context.Provider
      value={{ ...snapshot, toggle: store.toggle, reload: store.load }}
    >
      {children}
    </Context.Provider>
  );
}
export const useSavedPlans = () => useContext(Context);
