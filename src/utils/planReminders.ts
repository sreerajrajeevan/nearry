/** A plan on the person's day, as returned by `plans_for_day`. */
export type TodayPlan = {
  postId: string;
  title: string;
  startsAt: string;
  place: string | null;
  host: boolean;
  myStatus: "going" | "not_going" | null;
  going: number;
  members: number;
};

/** India-time calendar date ("2026-11-24"): the day the pop-up belongs to. */
export function indiaDayKey(at: Date): string {
  const india = new Date(at.getTime() + 330 * 60_000);
  return india.toISOString().slice(0, 10);
}

/**
 * Plans the "Plans for today" pop-up should show: hosted plans (as info) and
 * plans the member hasn't answered yet, minus any dismissed today.
 */
export function plansToPrompt(
  plans: TodayPlan[],
  dismissedToday: string[],
): TodayPlan[] {
  const dismissed = new Set(dismissedToday);
  return plans.filter(
    (p) => !dismissed.has(p.postId) && (p.host || p.myStatus === null),
  );
}

export function reminderStatusText(plan: TodayPlan): string {
  if (plan.host)
    return `You're hosting · ${plan.going} of ${plan.members} confirmed`;
  if (plan.myStatus === "going") return "You're going";
  if (plan.myStatus === "not_going") return "You said you're not going";
  return "Still going?";
}
