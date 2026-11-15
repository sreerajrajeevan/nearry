import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { listMyRequests } from "../services/joinRequests";
import { listMyBookings } from "../services/bookings";
import {
  MyOfferStatus,
  MyPlanStatus,
  myOfferStatuses,
  myRequestStatuses,
} from "../utils/myRequests";
import { useAuth } from "./AuthContext";

const Context = createContext<{
  statuses: ReadonlyMap<string, MyPlanStatus>;
  offerStatuses: ReadonlyMap<string, MyOfferStatus>;
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
  const [offerStatuses, setOfferStatuses] = useState<
    ReadonlyMap<string, MyOfferStatus>
  >(() => new Map());
  const version = useRef(0);
  const refresh = useCallback(async () => {
    const ticket = ++version.current;
    if (!userId) {
      setStatuses(new Map());
      setOfferStatuses(new Map());
      return;
    }
    // Each list updates on its own; a failure keeps the last known statuses.
    await Promise.all([
      listMyRequests(userId)
        .then((requests) => {
          if (ticket === version.current)
            setStatuses(myRequestStatuses(requests));
        })
        .catch(() => {}),
      listMyBookings(userId)
        .then((bookings) => {
          if (ticket === version.current)
            setOfferStatuses(myOfferStatuses(bookings));
        })
        .catch(() => {}),
    ]);
  }, [userId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return (
    <Context.Provider value={{ statuses, offerStatuses, refresh }}>
      {children}
    </Context.Provider>
  );
}

export const useMyRequests = () => useContext(Context);
export const useMyPlanStatus = (postId: string) =>
  useContext(Context)?.statuses.get(postId);
export const useMyOfferStatus = (offerId: string) =>
  useContext(Context)?.offerStatuses.get(offerId);
