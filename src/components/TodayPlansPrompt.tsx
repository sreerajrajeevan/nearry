import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { TodayPlansSheet } from "./TodayPlansSheet";
import {
  dismissForToday,
  dismissedToday,
  setPlanAttendance,
  todayPlans,
} from "../services/planReminders";
import { plansToPrompt, type TodayPlan } from "../utils/planReminders";

/**
 * Shows "Plans for today" when the app opens (or comes back) on a day with
 * plans the person hasn't answered. Each plan shows once a day.
 */
export function TodayPlansPrompt() {
  const navigation = useNavigation<any>();
  const [plans, setPlans] = useState<TodayPlan[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const checking = useRef(false);

  const check = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    try {
      const [all, dismissed] = await Promise.all([
        todayPlans(),
        dismissedToday(),
      ]);
      setPlans(plansToPrompt(all, dismissed));
    } catch {
      /* the reminder is a convenience: never block the app over it */
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });
    return () => sub.remove();
  }, [check]);

  const done = (plan: TodayPlan) => {
    void dismissForToday([plan.postId]);
    setPlans((left) => left.filter((p) => p.postId !== plan.postId));
  };
  const answer = async (plan: TodayPlan, going: boolean) => {
    setBusy(plan.postId);
    try {
      await setPlanAttendance(plan.postId, going);
    } catch {
      /* still close it; the plan page shows the real state */
    } finally {
      setBusy(null);
    }
    done(plan);
    // Not going: open the plan with the leave confirmation ready.
    if (!going)
      navigation.navigate("PostDetails", {
        postId: plan.postId,
        confirmLeave: true,
      });
  };

  return (
    <TodayPlansSheet
      plans={plans}
      busy={busy}
      onGoing={(p) => void answer(p, true)}
      onNotGoing={(p) => void answer(p, false)}
      onOpen={(p) => {
        done(p);
        navigation.navigate("PostDetails", { postId: p.postId });
      }}
      onClose={() => {
        void dismissForToday(plans.map((p) => p.postId));
        setPlans([]);
      }}
    />
  );
}
