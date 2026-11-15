import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { listMyRequests } from "../services/joinRequests";
import { MyPlanStatus, myRequestStatuses } from "../utils/myRequests";
import { useAuth } from "./AuthContext";

const Context = createContext<{
  statuses: ReadonlyMap<string, MyPlanStatus>;
  refresh: () => Promise<void>;
} | null>(null);

/** My join requests, so every plan card can show Requested / You're in. */
export function MyRequestsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = useAuth();
  const userId = profile?.accountType === "personal" ? profile.id : undefined;
  const [statuses, setStatuses] = useState<ReadonlyMap<string, MyPlanStatus>>(
    () => new Map(),
  );
  const version = useRef(0);
  const refresh = useCallback(async () => {
    const ticket = ++version.current;
    if (!userId) {
      setStatuses(new Map());
      return;
    }
    try {
      const requests = await listMyRequests(userId);
      if (ticket === version.current) setStatuses(myRequestStatuses(requests));
    } catch {
      // Keep the last known statuses; cards fall back to opening the plan.
    }
  }, [userId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return (
    <Context.Provider value={{ statuses, refresh }}>
      {children}
    </Context.Provider>
  );
}

export const useMyRequests = () => useContext(Context);
export const useMyPlanStatus = (postId: string) =>
  useContext(Context)?.statuses.get(postId);
