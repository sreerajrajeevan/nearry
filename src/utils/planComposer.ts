import type { ActivityArtwork } from "./activityArtwork";

/**
 * Activities offered when creating a plan. `art` is the illustrated miniature;
 * activities without one show a simple outline icon instead.
 */
export const PLAN_ACTIVITIES = [
  {
    id: "gym",
    label: "Gym",
    art: "fitness",
    title: "Looking for a gym partner",
    tag: "sports",
  },
  {
    id: "football",
    label: "Football",
    art: "football",
    title: "Anyone for a game of football?",
    tag: "sports",
  },
  {
    id: "badminton",
    label: "Badminton",
    art: "badminton",
    title: "Anyone up for badminton?",
    tag: "sports",
  },
  {
    id: "cricket",
    label: "Cricket",
    art: "cricket",
    title: "A friendly game of cricket",
    tag: "sports",
  },
  {
    id: "running",
    label: "Running",
    art: null,
    icon: "activity",
    title: "A run around the neighbourhood",
    tag: "sports",
  },
  {
    id: "cycling",
    label: "Cycling",
    art: "cycling",
    title: "Who’s up for a cycle ride?",
    tag: "outdoors",
  },
  {
    id: "tennis",
    label: "Tennis",
    art: null,
    icon: "target",
    title: "Looking for a tennis partner",
    tag: "sports",
  },
  {
    id: "coffee",
    label: "Coffee",
    art: "coffee",
    title: "Coffee and a good conversation",
    tag: "food",
  },
  {
    id: "food",
    label: "Food",
    art: "food",
    title: "Let’s try somewhere new to eat",
    tag: "food",
  },
  {
    id: "movies",
    label: "Movies",
    art: "cinema",
    title: "Anyone for a movie?",
    tag: "movies",
  },
  {
    id: "walk",
    label: "A walk",
    art: "gathering",
    title: "An easy walk and a little hello",
    tag: "outdoors",
  },
  {
    id: "other",
    label: "Other",
    art: null,
    icon: "plus",
    title: "",
    tag: "social",
  },
] as const satisfies readonly {
  id: string;
  label: string;
  art: ActivityArtwork | null;
  icon?: string;
  title: string;
  tag: string;
}[];
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
type ActivityId = (typeof PLAN_ACTIVITIES)[number]["id"];
/** Skill level only matters for sports and open-ended activities such as games. */
const LEVEL_ACTIVITIES: ReadonlySet<ActivityId> = new Set([
  "gym",
  "football",
  "badminton",
  "cricket",
  "running",
  "cycling",
  "tennis",
  "other",
]);
const BOOKING_LABELS: Partial<Record<ActivityId, string>> = {
  football: "Turf already booked",
  badminton: "Court already booked",
  tennis: "Court already booked",
  cricket: "Ground already booked",
  food: "Table already booked",
  movies: "Tickets already booked",
  other: "Venue already booked",
};
export const planAsksLevel = (activity?: ActivityId) =>
  !!activity && LEVEL_ACTIVITIES.has(activity);
export const planBookingLabel = (activity?: ActivityId) =>
  (activity && BOOKING_LABELS[activity]) ?? null;
const JOIN_NOTE_HINTS: Partial<Record<ActivityId, string>> = {
  football: "e.g. I’ll bring the football",
  badminton: "e.g. I have my own racket",
  tennis: "e.g. I have my own racket",
  cricket: "e.g. I can bring a bat",
  gym: "e.g. I usually train legs on this day",
  running: "e.g. I run about 6 min/km",
  cycling: "e.g. I have a road bike",
  movies: "e.g. Have you picked a show time?",
  coffee: "e.g. I’m new to the area",
  food: "e.g. I’m vegetarian, hope that’s fine",
  walk: "e.g. I’m new to the area",
};
/** An example note that fits the activity, shown in the join sheet. */
export const joinNoteHint = (activity?: ActivityId) =>
  `Anything the host should know? ${(activity && JOIN_NOTE_HINTS[activity]) ?? "e.g. A question about the plan"}`;
/** A readable age limit, or null when the plan is open to any adult. */
export function planAgeLabel(v: Pick<PlanDetails, "ageMin" | "ageMax">) {
  const min = v.ageMin ?? 18,
    max = v.ageMax ?? 100;
  if (min <= 18 && max >= 100) return null;
  return max >= 100 ? `Ages ${min}+` : `Ages ${min}–${max}`;
}
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

/**
 * Which create-plan section a validation message belongs to, so the editor
 * can scroll to it: 1 activity, 2 title, 3 when, 4 where, 5 who, 6 cost.
 */
export function planErrorSection(message: string): number {
  const m = message.toLowerCase();
  // Title first: "Give your activity a title" belongs to the title.
  if (/title|details|description/.test(m)) return 2;
  if (/planning|activity/.test(m)) return 1;
  if (/start|date|time|expir/.test(m)) return 3;
  if (/meeting place|coordinates|location/.test(m)) return 4;
  if (/age|vacanc|spots|participants/.test(m)) return 5;
  if (/cost|amount/.test(m)) return 6;
  return 8;
}
