export const PLAN_ACTIVITIES = [
  {
    id: "gym",
    label: "Gym",
    emoji: "🏋️",
    title: "Looking for a gym partner",
    tag: "sports",
  },
  {
    id: "football",
    label: "Football",
    emoji: "⚽",
    title: "Anyone for a game of football?",
    tag: "sports",
  },
  {
    id: "badminton",
    label: "Badminton",
    emoji: "🏸",
    title: "Anyone up for badminton?",
    tag: "sports",
  },
  {
    id: "cricket",
    label: "Cricket",
    emoji: "🏏",
    title: "A friendly game of cricket",
    tag: "sports",
  },
  {
    id: "running",
    label: "Running",
    emoji: "🏃",
    title: "A run around the neighbourhood",
    tag: "sports",
  },
  {
    id: "cycling",
    label: "Cycling",
    emoji: "🚴",
    title: "Who’s up for a cycle ride?",
    tag: "outdoors",
  },
  {
    id: "tennis",
    label: "Tennis",
    emoji: "🎾",
    title: "Looking for a tennis partner",
    tag: "sports",
  },
  {
    id: "coffee",
    label: "Coffee",
    emoji: "☕",
    title: "Coffee and a good conversation",
    tag: "food",
  },
  {
    id: "food",
    label: "Food",
    emoji: "🍜",
    title: "Let’s try somewhere new to eat",
    tag: "food",
  },
  {
    id: "movies",
    label: "Movies",
    emoji: "🎬",
    title: "Anyone for a movie?",
    tag: "movies",
  },
  {
    id: "walk",
    label: "A walk",
    emoji: "🌿",
    title: "An easy walk and a little hello",
    tag: "outdoors",
  },
  { id: "other", label: "Other", emoji: "✨", title: "", tag: "social" },
] as const;
export type PlanDetails = {
  activity?: (typeof PLAN_ACTIVITIES)[number]["id"];
  durationMinutes?: 30 | 60 | 90 | 120 | 180 | 240;
  level?: "any" | "beginner" | "intermediate" | "advanced";
  venueBooked?: boolean;
  costMode?: "free" | "split" | "person";
  ageMin?: number;
  ageMax?: number;
  totalCostCents?: number;
};
export function planPreferencesError(v: PlanDetails) {
  if (
    !Number.isInteger(v.ageMin ?? 18) ||
    !Number.isInteger(v.ageMax ?? 100) ||
    (v.ageMin ?? 18) < 18 ||
    (v.ageMax ?? 100) > 100 ||
    (v.ageMin ?? 18) > (v.ageMax ?? 100)
  )
    return "Choose an age range between 18 and 100.";
  return null;
}
/** Local calendar dates preserve the chosen time, including DST/calendar changes. */
export function composerDays(now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = (offset: number) => {
    const value = new Date(today);
    value.setDate(value.getDate() + offset);
    return value;
  };
  return [
    { label: "Today", date: day(0) },
    { label: "Tomorrow", date: day(1) },
    { label: "Sat", date: day((6 - today.getDay() + 7) % 7 || 7) },
    { label: "Sun", date: day((7 - today.getDay()) % 7 || 7) },
  ];
}
export const samePlanDay = (a: Date | null, b: Date) =>
  !!a &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
export function planCostCents(
  mode: PlanDetails["costMode"],
  amount: string,
  vacancies: number,
) {
  if (mode === "free") return 0;
  if (!amount.trim() || !Number.isFinite(Number(amount)) || Number(amount) < 0)
    return undefined;
  const cents = Math.round(Number(amount) * 100);
  return mode === "split" ? Math.ceil(cents / (vacancies + 1)) : cents;
}
